# auth.py
"""
Authentication module for EROS Gmail ETL
Handles Gmail API authentication using OAuth2 tokens from Secret Manager
"""

import json
import logging
from typing import Optional

from google.oauth2 import service_account
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.cloud import secretmanager

from config import Config
from exceptions import AuthenticationError

logger = logging.getLogger(__name__)

# Gmail API scopes
GMAIL_SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly'
]


def get_gmail_service(config: Config):
    """
    Get authenticated Gmail service - tries multiple methods

    Args:
        config: Configuration object

    Returns:
        Authenticated Gmail service object

    Raises:
        AuthenticationError: If authentication fails
    """

    # Method 1: Try user's gcloud CLI credentials first
    try:
        logger.info("Attempting Gmail service with user's gcloud CLI credentials")

        from google.auth import default
        credentials, project = default(scopes=GMAIL_SCOPES)

        # Build Gmail service
        service = build('gmail', 'v1', credentials=credentials)

        # Test the connection
        profile = service.users().getProfile(userId='me').execute()

        logger.info(f"✅ Gmail service initialized with gcloud CLI for: {profile.get('emailAddress')}")
        return service

    except Exception as e:
        logger.warning(f"gcloud CLI auth failed: {e}")

    # Method 2: Try service account from Secret Manager (if available)
    try:
        logger.info("Attempting Gmail service with service account from Secret Manager")

        credentials = get_oauth2_credentials(config)

        # Try with delegation first
        try:
            delegated_credentials = credentials.with_subject(config.TARGET_GMAIL_USER)
            service = build('gmail', 'v1', credentials=delegated_credentials)

            # Test the connection
            profile = service.users().getProfile(userId=config.TARGET_GMAIL_USER).execute()

            logger.info(f"✅ Gmail service initialized with service account delegation for: {profile.get('emailAddress')}")
            return service

        except Exception as delegation_error:
            logger.warning(f"Service account delegation failed: {delegation_error}")

            # Try without delegation (direct service account)
            service = build('gmail', 'v1', credentials=credentials)

            # Test with 'me'
            profile = service.users().getProfile(userId='me').execute()

            logger.info(f"✅ Gmail service initialized with direct service account for: {profile.get('emailAddress')}")
            return service

    except Exception as e:
        logger.error(f"Service account auth also failed: {e}")

    raise AuthenticationError("All authentication methods failed. Please check your credentials.")


def get_oauth2_credentials(config: Config):
    """
    Get service account credentials from Secret Manager

    Args:
        config: Configuration object

    Returns:
        Service account credentials

    Raises:
        AuthenticationError: If credentials cannot be loaded
    """
    try:
        # Load service account from Secret Manager
        if config.GMAIL_SA_SECRET_NAME:
            logger.info(f"Loading service account from Secret Manager: {config.GMAIL_SA_SECRET_NAME}")
            return get_oauth2_from_secret_manager(config)

        else:
            raise AuthenticationError("No service account credentials source configured")

    except Exception as e:
        logger.error(f"Failed to load service account credentials: {e}")
        raise AuthenticationError(f"Credential loading failed: {e}")


def get_oauth2_from_secret_manager(config: Config):
    """
    Load credentials from Secret Manager (handles both service account and OAuth2)

    Args:
        config: Configuration object

    Returns:
        Credentials (service account or OAuth2)

    Raises:
        AuthenticationError: If secret cannot be accessed
    """
    try:
        # Initialize Secret Manager client
        client = secretmanager.SecretManagerServiceClient()

        # Build secret name
        secret_name = f"projects/{config.PROJECT_ID}/secrets/{config.GMAIL_SA_SECRET_NAME}/versions/latest"

        # Access the secret
        response = client.access_secret_version(request={"name": secret_name})
        secret_data = response.payload.data.decode("UTF-8")

        # Parse JSON data
        credential_info = json.loads(secret_data)

        # Debug: Log what fields are available
        logger.info(f"Credential fields: {list(credential_info.keys())}")

        # Check if it's a service account or OAuth2 token
        if credential_info.get('type') == 'service_account':
            # Service account credentials
            logger.info("Loading service account credentials")
            credentials = service_account.Credentials.from_service_account_info(
                credential_info,
                scopes=GMAIL_SCOPES
            )
            logger.info("Successfully loaded service account credentials from Secret Manager")
            return credentials

        elif 'refresh_token' in credential_info or 'token' in credential_info:
            # OAuth2 user credentials
            logger.info("Loading OAuth2 user credentials")
            from google.oauth2.credentials import Credentials

            credentials = Credentials(
                token=credential_info.get('token'),
                refresh_token=credential_info.get('refresh_token'),
                token_uri=credential_info.get('token_uri', 'https://oauth2.googleapis.com/token'),
                client_id=credential_info.get('client_id'),
                client_secret=credential_info.get('client_secret'),
                scopes=GMAIL_SCOPES
            )
            logger.info("Successfully loaded OAuth2 credentials from Secret Manager")
            return credentials

        else:
            raise AuthenticationError(f"Unknown credential format in Secret Manager")

    except Exception as e:
        logger.error(f"Failed to load credentials from Secret Manager: {e}")
        raise AuthenticationError(f"Secret Manager access failed: {e}")


def test_gmail_connection(config: Config) -> bool:
    """
    Test Gmail API connection

    Args:
        config: Configuration object

    Returns:
        True if connection successful, False otherwise
    """
    try:
        service = get_gmail_service(config)

        # Try to get user profile (use 'me' for gcloud CLI auth)
        profile = service.users().getProfile(userId='me').execute()

        logger.info(f"Gmail connection test successful for: {profile.get('emailAddress')}")
        return True

    except Exception as e:
        logger.error(f"Gmail connection test failed: {e}")
        return False