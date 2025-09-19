# main.py
"""
EROS Gmail ETL Pipeline - Adapted from working python-etl
Fetches infloww.com reports from Gmail, processes Excel files, and loads to BigQuery.
Aligned with EROS Dataform pipeline for seamless integration.
"""

import os
import sys
import json
import logging
import traceback
import argparse
import re
from typing import List, Dict, Any, Optional, Set
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
import numpy as np

# Import our modules - copying from working python-etl structure
from config import Config
from gmail_client import GmailClient
from downloader import download_file, validate_excel_file
from processor import excel_to_dataframe, normalize_headers
from gcp_clients import (
    load_dataframe_to_bigquery,
    save_state,
    load_state,
    upload_to_gcs,
    check_for_duplicates,
    check_for_composite_duplicates,
    create_dataset_if_not_exists
)
from exceptions import (
    PipelineError,
    NoMessagesFoundError,
    NoDownloadUrlFound,
    InvalidFileError,
    BigQueryLoadError,
    DataValidationError
)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(f'gmail_etl_{datetime.now().strftime("%Y%m%d")}.log')
    ]
)
logger = logging.getLogger(__name__)


class ErosGmailETLPipeline:
    """
    EROS Gmail ETL Pipeline - adapted from working python-etl
    Handles the complete flow from Gmail to BigQuery for EROS system.
    """

    def __init__(self, config: Config, full_backfill: bool = False):
        """Initialize the pipeline with configuration."""
        self.cfg = config
        self.gmail_client = None
        self.state = {}
        self.processed_messages = set()
        self.failed_messages = set()
        self.full_backfill = full_backfill
        self.stats = {
            'messages_found': 0,
            'messages_processed': 0,
            'messages_failed': 0,
            'rows_loaded': 0,
            'duplicates_skipped': 0,
            'backfill_mode': full_backfill
        }

    def initialize(self):
        """Initialize clients and load state."""
        logger.info("="*80)
        mode = "FULL BACKFILL" if self.full_backfill else "INCREMENTAL"
        logger.info(f"EROS GMAIL ETL PIPELINE INITIALIZATION - {mode} MODE")
        logger.info("="*80)
        logger.info(f"Project: {self.cfg.PROJECT_ID}")
        logger.info(f"Dataset: {self.cfg.BQ_DATASET}")
        logger.info(f"Table: {self.cfg.BQ_TABLE}")
        logger.info(f"Target Gmail: {self.cfg.TARGET_GMAIL_USER}")
        logger.info(f"Backfill Mode: {self.full_backfill}")

        # Initialize Gmail client
        try:
            self.gmail_client = GmailClient(self.cfg)
            logger.info("✅ Gmail client initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Gmail client: {e}")
            raise PipelineError(f"Gmail initialization failed: {e}")

        # Load state
        self._load_state()

    def _load_state(self):
        """Load pipeline state from GCS."""
        if self.cfg.RESET_STATE or self.full_backfill:
            if self.full_backfill:
                logger.warning("🔄 FULL BACKFILL MODE - Ignoring processed messages state")
            else:
                logger.warning("🔄 RESET_STATE=true - Starting fresh")
            self.state = {}
            self.processed_messages = set()
            return

        try:
            state_uri = f"gs://{self.cfg.STATE_BUCKET}/{self.cfg.STATE_OBJECT_PATH}"
            self.state = load_state(state_uri)

            if self.state:
                self.processed_messages = set(self.state.get('processed_messages', []))
                logger.info(f"📋 Loaded state: {len(self.processed_messages)} processed messages")
            else:
                logger.info("📋 No existing state found - starting fresh")
        except Exception as e:
            logger.warning(f"Could not load state: {e}")
            self.state = {}
            self.processed_messages = set()

    def _save_state(self):
        """Save pipeline state to GCS."""
        try:
            self.state['processed_messages'] = list(self.processed_messages)
            self.state['failed_messages'] = list(self.failed_messages)
            self.state['last_run'] = datetime.utcnow().isoformat()
            self.state['stats'] = self.stats

            state_uri = f"gs://{self.cfg.STATE_BUCKET}/{self.cfg.STATE_OBJECT_PATH}"
            save_state(self.state, state_uri)
            logger.info("💾 State saved successfully")
        except Exception as e:
            logger.error(f"Failed to save state: {e}")

    def fetch_messages(self) -> List[Dict[str, Any]]:
        """Fetch unprocessed messages from Gmail."""
        logger.info("\n" + "="*60)
        logger.info("FETCHING GMAIL MESSAGES")
        logger.info("="*60)

        try:
            # Adjust message limits for backfill mode
            if self.full_backfill:
                max_results = 1000  # Much higher limit for backfill
                # Update search query to not limit by date for full backfill
                original_query = self.cfg.GMAIL_SEARCH_QUERY
                # Remove newer_than restriction for full backfill
                backfill_query = re.sub(r'\s*newer_than:\w+', '', original_query)
                logger.info(f"🔄 Full backfill mode - using query: {backfill_query}")
                messages = self.gmail_client.list_report_messages(
                    max_results=max_results,
                    search_query=backfill_query
                )
            else:
                # Normal incremental mode
                messages = self.gmail_client.list_report_messages(
                    max_results=self.cfg.MAX_MESSAGES_PER_RUN
                )

            self.stats['messages_found'] = len(messages)
            logger.info(f"Found {len(messages)} total messages")

            # Filter out already processed messages
            unprocessed = []
            for msg in messages:
                msg_id = msg.get('id')
                if msg_id not in self.processed_messages:
                    unprocessed.append(msg)
                else:
                    logger.debug(f"Skipping already processed message: {msg_id}")

            logger.info(f"📧 {len(unprocessed)} unprocessed messages to process")
            return unprocessed

        except NoMessagesFoundError:
            logger.info("No messages found matching search criteria")
            return []
        except Exception as e:
            logger.error(f"Failed to fetch messages: {e}")
            raise PipelineError(f"Gmail fetch failed: {e}")

    def process_message(self, message: Dict[str, Any]) -> Optional[pd.DataFrame]:
        """
        Process a single email message.

        Returns:
            DataFrame with processed data or None if failed
        """
        msg_id = message.get('id')
        logger.info(f"\n📨 Processing message {msg_id}")

        try:
            # Get message details
            msg_details = self.gmail_client.get_message_details(msg_id)
            logger.info(f"  Subject: {msg_details.get('subject', 'N/A')[:100]}")

            # Fetch message content
            internal_date, email_content = self.gmail_client.fetch_message(msg_id)

            # Extract download link and page name
            try:
                download_url, page_name = self.gmail_client.extract_report_link_and_page(
                    email_content,
                    msg_id
                )
            except NoDownloadUrlFound:
                logger.warning(f"  ⚠️ No download URL found in message {msg_id}")
                self.failed_messages.add(msg_id)
                return None

            logger.info(f"  Page: '{page_name}'")
            logger.info(f"  URL: {download_url[:100]}...")

            # Download Excel file
            temp_dir = Path("/tmp/gmail_etl")
            temp_dir.mkdir(exist_ok=True)

            try:
                local_path = download_file(
                    download_url,
                    page_name,
                    msg_id,
                    str(temp_dir)
                )
                logger.info(f"  ✅ Downloaded: {local_path}")
            except Exception as e:
                logger.error(f"  ❌ Download failed: {e}")
                self.failed_messages.add(msg_id)
                return None

            # Validate Excel file
            if not validate_excel_file(local_path):
                logger.error(f"  ❌ Invalid Excel file: {local_path}")
                self.failed_messages.add(msg_id)
                return None

            # Upload raw file to GCS for backup
            try:
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                gcs_path = f"{self.cfg.GCS_PREFIX}/{page_name}_{timestamp}.xlsx"
                gcs_uri = f"gs://{self.cfg.GCS_RAW_BUCKET}/{gcs_path}"
                upload_to_gcs(local_path, gcs_uri, metadata={
                    'message_id': msg_id,
                    'page_name': page_name,
                    'processed_at': datetime.utcnow().isoformat()
                })
                logger.info(f"  📤 Backed up to: {gcs_uri}")
            except Exception as e:
                logger.warning(f"  Failed to backup to GCS: {e}")
                gcs_uri = ""  # Continue processing even if backup fails

            # Read and process Excel file
            try:
                df = excel_to_dataframe(local_path)
                logger.info(f"  📊 Read {len(df)} rows, {len(df.columns)} columns")
            except Exception as e:
                logger.error(f"  ❌ Failed to read Excel file: {e}")
                self.failed_messages.add(msg_id)
                return None

            # Clean up temp file
            try:
                os.remove(local_path)
            except:
                pass

            # Process the DataFrame for EROS system
            df = self._process_dataframe_for_eros(df, page_name, msg_id, gcs_uri)

            return df

        except Exception as e:
            logger.error(f"  ❌ Failed to process message {msg_id}: {e}")
            logger.error(traceback.format_exc())
            self.failed_messages.add(msg_id)
            return None

    def _process_dataframe_for_eros(
        self,
        df: pd.DataFrame,
        page_name: str,
        msg_id: str,
        source_file: str
    ) -> pd.DataFrame:
        """
        Process DataFrame to match EROS Dataform expectations.
        Aligns with definitions/messaging/stg/mass_messages.sqlx schema.
        """
        logger.info(f"  Processing DataFrame for EROS system")

        # Normalize column names first
        df = normalize_headers(df)

        # Log columns after normalization for debugging
        logger.debug(f"  Columns after normalization: {list(df.columns)}")

        # ============================================
        # EROS SCHEMA ALIGNMENT
        # ============================================
        # Expected columns in eros_source.mass_message_daily_final:
        # message_id, sender, sending_time, price, sent, viewed, purchased, earnings, message_text

        # Add metadata columns
        df['message_id'] = msg_id
        df['source_file'] = f"gmail_{msg_id}"
        df['loaded_at'] = datetime.now().isoformat()

        # Keep sending_time as STRING for proper parsing in Dataform
        # The Dataform expects formats like '%Y-%m-%dT%H:%M:%E*S%Ez' or '%Y-%m-%d %H:%M:%S'
        if 'sending_time' in df.columns:
            df['sending_time'] = df['sending_time'].astype(str)
            # Clean any "SD Chu" suffix from infloww format
            df['sending_time'] = df['sending_time'].str.replace('SD Chu', '', regex=False).str.strip()
            logger.debug(f"  Kept sending_time as string for Dataform parsing")

        # Keep message column as 'message' to match BigQuery schema
        # Don't rename to message_text as the table expects 'message'

        # Clean money columns but keep Price as string with $ for staging
        if 'price' in df.columns:
            # Keep price as string for staging (will be parsed in transfer query)
            # Replace 'nan' strings with '-' to match original format
            df['price'] = df['price'].astype(str).replace('nan', '-').replace('None', '-')

        if 'earnings' in df.columns:
            # Clean earnings to float
            df['earnings'] = df['earnings'].astype(str).str.replace(', ', '').str.replace(',', '')
            df['earnings'] = pd.to_numeric(df['earnings'], errors='coerce').fillna(0.0)

        # Clean numeric columns
        numeric_columns = ['sent', 'viewed', 'purchased']
        for col in numeric_columns:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).astype('Int64')

        # Clean text columns
        text_columns = ['message_text', 'sender', 'status', 'withdrawn_by']
        for col in text_columns:
            if col in df.columns:
                df[col] = df[col].astype(str).replace('nan', '').replace('None', '').str.strip()

        # Ensure all required columns exist
        required_columns = [
            'message_id', 'sender', 'sending_time', 'price', 'sent',
            'viewed', 'purchased', 'earnings', 'message_text'
        ]

        for col in required_columns:
            if col not in df.columns:
                if col in ['sent', 'viewed', 'purchased']:
                    df[col] = 0
                else:
                    df[col] = ''

        # NO within-file deduplication - each row represents a unique time period
        # All rows from the 7-day export are legitimate data points
        # Deduplication happens at BigQuery level based on (message_id + sending_time)

        logger.info(f"  ✅ Processed {len(df)} rows for EROS system")
        return df

    def upload_to_bigquery(self, df: pd.DataFrame) -> bool:
        """Upload DataFrame to BigQuery for EROS system with deduplication."""
        if df.empty:
            logger.warning("Empty DataFrame - nothing to upload")
            return True

        logger.info(f"\n📤 Uploading {len(df)} rows to EROS BigQuery table")

        # Select only the columns expected by EROS system
        expected_columns = [
            'message_id', 'sender', 'sending_time', 'price', 'sent',
            'viewed', 'purchased', 'earnings', 'message'
        ]

        # Ensure all expected columns exist
        for col in expected_columns:
            if col not in df.columns:
                if col in ['sent', 'viewed', 'purchased']:
                    df[col] = 0
                else:
                    df[col] = ''

        # Select and reorder columns
        df = df[expected_columns]

        # Perform deduplication check against BigQuery
        try:
            table_id = f"{self.cfg.PROJECT_ID}.{self.cfg.BQ_DATASET}.{self.cfg.BQ_TABLE}"
            logger.info(f"📤 Uploading to EROS table: {table_id}")

            # Check for existing (message_id + sending_time) combinations to avoid duplicates
            # Create composite keys for deduplication
            df['composite_key'] = df['message_id'] + '|' + df['sending_time']
            composite_keys = df['composite_key'].tolist()
            existing_keys = check_for_composite_duplicates(table_id, composite_keys)

            if existing_keys:
                logger.info(f"🔄 Found {len(existing_keys)} existing (message_id + sending_time) combinations, filtering out duplicates")
                # Remove rows that already exist
                df_filtered = df[~df['composite_key'].isin(existing_keys)]
                self.stats['duplicates_skipped'] += len(df) - len(df_filtered)
                df = df_filtered

            # Drop temporary composite key column
            if 'composite_key' in df.columns:
                df = df.drop(columns=['composite_key'])

            if df.empty:
                logger.info("📝 All rows were duplicates, nothing to upload")
                return True

            logger.info(f"📤 Uploading {len(df)} new rows after deduplication")

            # Create dataset if it doesn't exist
            dataset_id = f"{self.cfg.PROJECT_ID}.{self.cfg.BQ_DATASET}"
            create_dataset_if_not_exists(dataset_id, self.cfg.BIGQUERY_LOCATION)

            rows_loaded = load_dataframe_to_bigquery(
                df,
                table_id,
                location=self.cfg.BIGQUERY_LOCATION,
                write_disposition="WRITE_APPEND"
            )

            self.stats['rows_loaded'] += rows_loaded
            logger.info(f"✅ Successfully loaded {rows_loaded} rows to EROS system")
            return True

        except BigQueryLoadError as e:
            logger.error(f"❌ BigQuery load failed: {e}")
            self._save_debug_data(df, "bigquery_failed")
            return False
        except Exception as e:
            logger.error(f"❌ Unexpected error during BigQuery upload: {e}")
            self._save_debug_data(df, "upload_error")
            return False

    def _save_debug_data(self, df: pd.DataFrame, prefix: str):
        """Save DataFrame to CSV for debugging."""
        try:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"/tmp/{prefix}_{timestamp}.csv"
            df.to_csv(filename, index=False)
            logger.info(f"Saved debug data to {filename}")
        except Exception as e:
            logger.error(f"Failed to save debug data: {e}")

    def run(self):
        """Main pipeline execution."""
        logger.info("="*80)
        logger.info("STARTING EROS GMAIL ETL PIPELINE")
        logger.info("="*80)

        try:
            # Fetch unprocessed messages
            messages = self.fetch_messages()

            if not messages:
                logger.info("No new messages to process")
                return

            # Process each message
            for message in messages:
                msg_id = message.get('id')

                try:
                    # Process the message
                    df = self.process_message(message)

                    if df is not None and not df.empty:
                        # Upload to BigQuery
                        success = self.upload_to_bigquery(df)

                        if success:
                            self.processed_messages.add(msg_id)
                            self.stats['messages_processed'] += 1
                            logger.info(f"✅ Successfully processed message {msg_id}")
                        else:
                            self.failed_messages.add(msg_id)
                            self.stats['messages_failed'] += 1
                    else:
                        logger.warning(f"No data extracted from message {msg_id}")
                        self.failed_messages.add(msg_id)
                        self.stats['messages_failed'] += 1

                except Exception as e:
                    logger.error(f"Failed to process message {msg_id}: {e}")
                    self.failed_messages.add(msg_id)
                    self.stats['messages_failed'] += 1

            # Save state after processing all messages
            self._save_state()

            # Print summary
            logger.info("\n" + "="*60)
            logger.info("EROS PIPELINE SUMMARY")
            logger.info("="*60)
            logger.info(f"Messages found:     {self.stats['messages_found']}")
            logger.info(f"Messages processed: {self.stats['messages_processed']}")
            logger.info(f"Messages failed:    {self.stats['messages_failed']}")
            logger.info(f"Rows loaded:        {self.stats['rows_loaded']}")
            logger.info(f"Duplicates skipped: {self.stats['duplicates_skipped']}")

        except Exception as e:
            logger.error(f"Pipeline failed: {e}")
            logger.error(traceback.format_exc())
            raise PipelineError(f"Pipeline execution failed: {e}")
        finally:
            # Always try to save state
            self._save_state()


# Entry point
def main():
    """Main entry point with command line argument support"""
    parser = argparse.ArgumentParser(
        description="EROS Gmail ETL Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Normal incremental run (respects processed_emails.json state)
  python main.py

  # Full backfill run (ignores state, processes ALL emails)
  python main.py --full

  # Full backfill with higher message limit
  python main.py --full --max-messages 2000
        """
    )

    parser.add_argument(
        '--full',
        action='store_true',
        help='Full backfill mode: ignore processed emails state and grab ALL relevant emails'
    )

    parser.add_argument(
        '--max-messages',
        type=int,
        default=None,
        help='Override maximum messages per run (default: 5 for incremental, 1000 for --full)'
    )

    parser.add_argument(
        '--log-level',
        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
        default='INFO',
        help='Set logging level'
    )

    args = parser.parse_args()

    # Configure logging
    logging.getLogger().setLevel(getattr(logging, args.log_level))

    try:
        # Load configuration
        config = Config()

        # Override max messages if specified
        if args.max_messages:
            config.MAX_MESSAGES_PER_RUN = args.max_messages

        # Create and run pipeline
        pipeline = ErosGmailETLPipeline(config, full_backfill=args.full)

        if args.full:
            logger.info("🔄 Running FULL BACKFILL - will process ALL emails regardless of state")
            logger.info("⚠️  This may take a while and process many messages!")
        else:
            logger.info("🔄 Running INCREMENTAL mode - will skip already processed emails")

        pipeline.initialize()
        pipeline.run()

        logger.info("✨ EROS Pipeline completed successfully")

        # Print final stats
        mode = "FULL BACKFILL" if args.full else "INCREMENTAL"
        logger.info(f"📊 {mode} COMPLETED:")
        logger.info(f"   Messages Found: {pipeline.stats['messages_found']}")
        logger.info(f"   Messages Processed: {pipeline.stats['messages_processed']}")
        logger.info(f"   Rows Loaded: {pipeline.stats['rows_loaded']}")
        logger.info(f"   Duplicates Skipped: {pipeline.stats['duplicates_skipped']}")

        sys.exit(0)

    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()