import os
from typing import Optional

class Config:
    """Configuration for Gmail ETL pipeline - EROS system integration"""

    def __init__(self):
        # GCP Project Settings
        self.PROJECT_ID = os.environ.get('PROJECT_ID', 'of-scheduler-proj')

        # Gmail API Settings
        self.TARGET_GMAIL_USER = os.environ.get('TARGET_GMAIL_USER', 'kyle@erosops.com')
        self.GMAIL_SEARCH_QUERY = os.environ.get('GMAIL_SEARCH_QUERY',
            'from:no-reply@infloww.com subject:"OF mass message history report is ready for download" newer_than:7d')

        # Service Account Settings (for Gmail domain-wide delegation)
        self.SERVICE_ACCOUNT_EMAIL = os.environ.get('SERVICE_ACCOUNT_EMAIL',
            'gmail-elt-pipeline-sa@of-scheduler-proj.iam.gserviceaccount.com')
        self.GMAIL_SERVICE_ACCOUNT_FILE = os.environ.get('GMAIL_SERVICE_ACCOUNT_FILE', '')

        # Secret Manager Configuration
        self.GMAIL_SA_SECRET_NAME = os.environ.get('GMAIL_SA_SECRET_NAME', "gmail-etl")

        # ============================================
        # 🔥 EROS SYSTEM BIGQUERY CONFIGURATION 🔥
        # ============================================
        # BigQuery Settings - ALIGNED WITH EROS DATAFORM PIPELINE
        self.BQ_DATASET = os.environ.get('BQ_DATASET', 'eros_source')  # EROS source dataset
        self.BQ_TABLE = os.environ.get('BQ_TABLE', 'mass_message_daily_final')  # EROS expected table
        self.BIGQUERY_LOCATION = os.environ.get('BIGQUERY_LOCATION', 'US')

        # GCS Settings (for storing raw files and state)
        self.GCS_RAW_BUCKET = os.environ.get('GCS_RAW_BUCKET', 'eros-report-files-raw-2025')
        self.GCS_PREFIX = os.environ.get('GCS_PREFIX', 'gmail_etl/reports')

        # State Management (to track processed emails)
        self.STATE_BUCKET = os.environ.get('STATE_BUCKET', 'eros-data-pipe-state')
        self.STATE_OBJECT_PATH = os.environ.get('STATE_OBJECT_PATH', 'processed_emails.json')

        # Processing Settings
        self.LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
        self.RESET_STATE = os.environ.get('RESET_STATE', 'false').lower() == 'true'
        self.MAX_MESSAGES_PER_RUN = int(os.environ.get('MAX_MESSAGES_PER_RUN', '5'))  # Conservative for testing

        # Cloud Run Configuration
        self.CLOUD_RUN_REGION = os.environ.get('CLOUD_RUN_REGION', 'us-central1')
        self.JOB_NAME = os.environ.get('JOB_NAME', 'gmail-etl-job')
        self.CLOUD_RUN_SERVICE_ACCOUNT = os.environ.get('CLOUD_RUN_SERVICE_ACCOUNT',
            'gmail-elt-pipeline-sa@of-scheduler-proj.iam.gserviceaccount.com')

    def __repr__(self):
        return f"Config(project={self.PROJECT_ID}, dataset={self.BQ_DATASET}, table={self.BQ_TABLE})"