# gcp_clients.py
"""
Google Cloud Platform client wrappers for EROS Gmail ETL.
Handles BigQuery, GCS, and state management.
"""

import json
import time
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
from pathlib import Path

import pandas as pd
import numpy as np
from google.cloud import bigquery
from google.cloud import storage
from google.cloud.exceptions import NotFound, Conflict
from google.api_core.exceptions import RetryError, DeadlineExceeded

from exceptions import BigQueryLoadError

logger = logging.getLogger(__name__)

# Initialize clients (singleton pattern)
_bigquery_client = None
_storage_client = None


def get_bigquery_client():
    """Get or create BigQuery client"""
    global _bigquery_client
    if _bigquery_client is None:
        _bigquery_client = bigquery.Client()
    return _bigquery_client


def get_storage_client():
    """Get or create Storage client"""
    global _storage_client
    if _storage_client is None:
        _storage_client = storage.Client()
    return _storage_client


# -----------------------------------------------------------------------------
# GCS Functions
# -----------------------------------------------------------------------------

def parse_gcs_uri(gcs_uri: str) -> tuple:
    """Parse GCS URI into bucket and blob parts"""
    if not gcs_uri.startswith('gs://'):
        raise ValueError(f"Invalid GCS URI: {gcs_uri}")

    path_parts = gcs_uri[5:].split('/', 1)
    bucket_name = path_parts[0]
    blob_name = path_parts[1] if len(path_parts) > 1 else ''

    return bucket_name, blob_name


def upload_to_gcs(local_path: str, gcs_uri: str, metadata: Optional[Dict] = None):
    """Upload local file to GCS"""
    bucket_name, blob_name = parse_gcs_uri(gcs_uri)

    client = get_storage_client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_name)

    if metadata:
        blob.metadata = metadata

    blob.upload_from_filename(local_path)
    logger.info(f"Uploaded {local_path} to {gcs_uri}")


def download_from_gcs(gcs_uri: str, local_path: str):
    """Download file from GCS to local path"""
    bucket_name, blob_name = parse_gcs_uri(gcs_uri)

    client = get_storage_client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_name)

    blob.download_to_filename(local_path)
    logger.info(f"Downloaded {gcs_uri} to {local_path}")


def save_state(state: Dict[str, Any], state_uri: str):
    """Save pipeline state to GCS"""
    bucket_name, blob_name = parse_gcs_uri(state_uri)

    client = get_storage_client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_name)

    blob.upload_from_string(
        json.dumps(state, indent=2, default=str),
        content_type='application/json'
    )
    logger.debug(f"Saved state to {state_uri}")


def load_state(state_uri: str) -> Optional[Dict[str, Any]]:
    """Load pipeline state from GCS"""
    try:
        bucket_name, blob_name = parse_gcs_uri(state_uri)

        client = get_storage_client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(blob_name)

        if not blob.exists():
            logger.info(f"No state file found at {state_uri}")
            return None

        content = blob.download_as_text()
        state = json.loads(content)
        logger.debug(f"Loaded state from {state_uri}")
        return state

    except Exception as e:
        logger.warning(f"Failed to load state from {state_uri}: {e}")
        return None


# -----------------------------------------------------------------------------
# BigQuery Functions
# -----------------------------------------------------------------------------

def load_dataframe_to_bigquery(
    df: pd.DataFrame,
    table_id: str,
    location: str = 'US',
    write_disposition: str = 'WRITE_APPEND'
) -> int:
    """
    Load DataFrame to BigQuery table with enhanced error handling.

    Returns:
        Number of rows loaded
    """
    if df.empty:
        logger.warning("Empty DataFrame - nothing to load")
        return 0

    # Prepare DataFrame for BigQuery
    df_prepared = df.copy()

    # Replace NaN with None for BigQuery compatibility
    df_prepared = df_prepared.where(pd.notnull(df_prepared), None)

    # Convert any datetime columns to string to avoid timezone issues
    for col in df_prepared.columns:
        if df_prepared[col].dtype == 'object':
            # Handle potential datetime strings
            continue
        elif pd.api.types.is_datetime64_any_dtype(df_prepared[col]):
            df_prepared[col] = df_prepared[col].dt.strftime('%Y-%m-%d %H:%M:%S')

    try:
        client = get_bigquery_client()

        # Configure load job
        job_config = bigquery.LoadJobConfig(
            write_disposition=write_disposition,
            autodetect=True,  # Let BigQuery infer schema
            create_disposition="CREATE_IF_NEEDED"
        )

        # Start load job
        logger.info(f"Loading {len(df_prepared)} rows to {table_id}")
        job = client.load_table_from_dataframe(
            df_prepared,
            table_id,
            job_config=job_config,
            location=location
        )

        # Wait for job to complete
        job.result()

        # Check for errors
        if job.errors:
            error_msg = f"BigQuery load job had errors: {job.errors}"
            logger.error(error_msg)
            raise BigQueryLoadError(error_msg)

        rows_loaded = len(df_prepared)
        logger.info(f"✅ Successfully loaded {rows_loaded} rows to {table_id}")
        return rows_loaded

    except Exception as e:
        error_msg = f"Failed to load data to BigQuery: {e}"
        logger.error(error_msg)
        raise BigQueryLoadError(error_msg)


def check_for_duplicates(table_id: str, message_ids: List[str]) -> List[str]:
    """
    Check which message IDs already exist in the table.

    Returns:
        List of message IDs that already exist
    """
    if not message_ids:
        return []

    try:
        client = get_bigquery_client()

        # Build query to check for existing message IDs
        ids_str = ', '.join([f"'{mid}'" for mid in message_ids])
        query = f"""
            SELECT DISTINCT message_id
            FROM `{table_id}`
            WHERE message_id IN ({ids_str})
        """

        query_job = client.query(query)
        results = query_job.result()

        existing_ids = [row.message_id for row in results]
        logger.info(f"Found {len(existing_ids)} existing message IDs out of {len(message_ids)} checked")

        return existing_ids

    except Exception as e:
        logger.warning(f"Failed to check for duplicates: {e}")
        return []  # If check fails, assume no duplicates


def check_for_composite_duplicates(table_id: str, composite_keys: List[str]) -> List[str]:
    """
    Check which (message_id + sending_time) combinations already exist in the table.

    Args:
        table_id: BigQuery table ID
        composite_keys: List of 'message_id|sending_time' strings

    Returns:
        List of composite keys that already exist
    """
    if not composite_keys:
        return []

    try:
        client = get_bigquery_client()

        # Parse composite keys back into message_id and sending_time pairs
        conditions = []
        for key in composite_keys:
            if '|' in key:
                message_id, sending_time = key.split('|', 1)
                conditions.append(f"(message_id = '{message_id}' AND sending_time = '{sending_time}')")

        if not conditions:
            return []

        # Build query to check for existing combinations
        conditions_str = ' OR '.join(conditions)
        query = f"""
            SELECT CONCAT(message_id, '|', sending_time) as composite_key
            FROM `{table_id}`
            WHERE {conditions_str}
        """

        query_job = client.query(query)
        results = query_job.result()

        existing_keys = [row.composite_key for row in results]
        logger.info(f"Found {len(existing_keys)} existing (message_id + sending_time) combinations out of {len(composite_keys)} checked")

        return existing_keys

    except Exception as e:
        logger.warning(f"Failed to check for composite duplicates: {e}")
        return []  # If check fails, assume no duplicates


def get_table_info(table_id: str) -> Optional[Dict[str, Any]]:
    """Get information about a BigQuery table"""
    try:
        client = get_bigquery_client()
        table = client.get_table(table_id)

        return {
            'num_rows': table.num_rows,
            'num_bytes': table.num_bytes,
            'created': table.created,
            'modified': table.modified,
            'schema': [{'name': field.name, 'type': field.field_type} for field in table.schema]
        }
    except NotFound:
        logger.warning(f"Table not found: {table_id}")
        return None
    except Exception as e:
        logger.error(f"Error getting table info: {e}")
        return None


def create_dataset_if_not_exists(dataset_id: str, location: str = 'US'):
    """Create BigQuery dataset if it doesn't exist"""
    try:
        client = get_bigquery_client()

        # Try to get the dataset
        try:
            dataset = client.get_dataset(dataset_id)
            logger.info(f"Dataset {dataset_id} already exists")
            return dataset
        except NotFound:
            pass

        # Create the dataset
        dataset = bigquery.Dataset(dataset_id)
        dataset.location = location
        dataset = client.create_dataset(dataset, timeout=30)

        logger.info(f"Created dataset {dataset_id} in {location}")
        return dataset

    except Exception as e:
        logger.error(f"Failed to create dataset {dataset_id}: {e}")
        raise