# gmail_client.py
"""
Gmail API client for EROS ETL
Simplified version for basic message fetching and link extraction
"""

import base64
import re
import logging
from typing import Optional, Tuple, List, Dict, Any
from datetime import datetime

from bs4 import BeautifulSoup

from config import Config
from auth import get_gmail_service
from exceptions import (
    GmailError,
    NoMessagesFoundError,
    MessageFetchError,
    NoDownloadUrlFound
)

logger = logging.getLogger(__name__)


class GmailClient:
    """Gmail API client for fetching OnlyFans reports"""

    def __init__(self, config: Config):
        self.cfg = config
        self.service = None
        self.user_id = None  # Will be determined dynamically
        self._initialize_service()

    def _initialize_service(self):
        """Initialize Gmail service"""
        try:
            self.service = get_gmail_service(self.cfg)

            # Determine the correct user ID to use
            self._determine_user_id()

            logger.info("Gmail service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Gmail service: {e}")
            raise GmailError(f"Gmail service initialization failed: {e}")

    def _determine_user_id(self):
        """Determine which user ID to use based on authentication method"""
        try:
            # First try 'me' (works with user credentials and some service accounts)
            profile = self.service.users().getProfile(userId='me').execute()
            self.user_id = 'me'
            logger.info(f"Using 'me' as user ID for: {profile.get('emailAddress')}")
        except:
            try:
                # Fallback to target user (works with domain delegation)
                profile = self.service.users().getProfile(userId=self.cfg.TARGET_GMAIL_USER).execute()
                self.user_id = self.cfg.TARGET_GMAIL_USER
                logger.info(f"Using target user ID for: {profile.get('emailAddress')}")
            except Exception as e:
                logger.error(f"Could not determine user ID: {e}")
                # Default to 'me'
                self.user_id = 'me'

    def list_report_messages(self, max_results: int = 100, search_query: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        List messages matching the search query

        Args:
            max_results: Maximum number of messages to return
            search_query: Optional custom search query (uses config default if None)

        Returns:
            List of message metadata dictionaries

        Raises:
            NoMessagesFoundError: If no messages found
            GmailError: If API call fails
        """
        try:
            # Use custom query or default from config
            query = search_query or self.cfg.GMAIL_SEARCH_QUERY
            logger.info(f"Searching for messages: '{query}'")

            # Search for messages
            results = self.service.users().messages().list(
                userId=self.user_id,
                q=query,
                maxResults=max_results
            ).execute()

            messages = results.get('messages', [])

            if not messages:
                raise NoMessagesFoundError("No messages found matching search criteria")

            logger.info(f"Found {len(messages)} messages")
            return messages

        except NoMessagesFoundError:
            raise
        except Exception as e:
            logger.error(f"Failed to list messages: {e}")
            raise GmailError(f"Message listing failed: {e}")

    def get_message_details(self, message_id: str) -> Dict[str, Any]:
        """Get basic message details"""
        try:
            message = self.service.users().messages().get(
                userId=self.user_id,
                id=message_id,
                format='metadata',
                metadataHeaders=['Subject', 'From', 'Date']
            ).execute()

            headers = {h['name']: h['value'] for h in message.get('payload', {}).get('headers', [])}

            return {
                'id': message_id,
                'subject': headers.get('Subject', ''),
                'from': headers.get('From', ''),
                'date': headers.get('Date', ''),
                'internal_date': message.get('internalDate', '')
            }
        except Exception as e:
            logger.error(f"Failed to get message details for {message_id}: {e}")
            return {'id': message_id}

    def fetch_message(self, message_id: str) -> Tuple[Optional[str], str]:
        """
        Fetch message content

        Args:
            message_id: Gmail message ID

        Returns:
            Tuple of (internal_date, email_content)

        Raises:
            MessageFetchError: If message cannot be fetched
        """
        try:
            logger.debug(f"Fetching message content for {message_id}")

            message = self.service.users().messages().get(
                userId=self.user_id,
                id=message_id,
                format='full'
            ).execute()

            internal_date = message.get('internalDate')
            payload = message.get('payload', {})

            # Extract body content
            email_content = self._extract_message_body(payload)

            if not email_content:
                raise MessageFetchError(f"No content found in message {message_id}")

            return internal_date, email_content

        except MessageFetchError:
            raise
        except Exception as e:
            logger.error(f"Failed to fetch message {message_id}: {e}")
            raise MessageFetchError(f"Message fetch failed: {e}")

    def _extract_message_body(self, payload: Dict[str, Any]) -> str:
        """Extract body content from message payload"""
        body_content = ""

        # Handle multipart messages
        if 'parts' in payload:
            for part in payload['parts']:
                if part.get('mimeType') in ['text/html', 'text/plain']:
                    body_data = part.get('body', {}).get('data', '')
                    if body_data:
                        decoded = base64.urlsafe_b64decode(body_data).decode('utf-8', errors='ignore')
                        body_content += decoded
        else:
            # Single part message
            body_data = payload.get('body', {}).get('data', '')
            if body_data:
                body_content = base64.urlsafe_b64decode(body_data).decode('utf-8', errors='ignore')

        return body_content

    def extract_report_link_and_page(self, email_content: str, message_id: str) -> Tuple[str, str]:
        """
        Extract download link and page name from email content

        Args:
            email_content: HTML email content
            message_id: Message ID for logging

        Returns:
            Tuple of (download_url, page_name)

        Raises:
            NoDownloadUrlFound: If no download URL found
        """
        try:
            # Parse HTML content
            soup = BeautifulSoup(email_content, 'html.parser')

            # Look for download links - common patterns for infloww.com
            download_url = None
            page_name = "unknown_page"

            # Pattern 1: Look for links with "download" in text or href
            for link in soup.find_all('a', href=True):
                href = link['href']
                text = link.get_text().strip().lower()

                if 'download' in text or 'download' in href.lower():
                    download_url = href
                    # Try to extract page name from link text or URL
                    if link.get_text().strip():
                        page_name = link.get_text().strip()
                    break

            # Pattern 2: Look for infloww.com links
            if not download_url:
                for link in soup.find_all('a', href=True):
                    href = link['href']
                    if 'infloww.com' in href:
                        download_url = href
                        page_name = link.get_text().strip() or "infloww_report"
                        break

            # Pattern 3: Look for any external download links
            if not download_url:
                for link in soup.find_all('a', href=True):
                    href = link['href']
                    if href.startswith('http') and any(ext in href.lower() for ext in ['.xlsx', '.xls', 'export', 'report']):
                        download_url = href
                        page_name = link.get_text().strip() or "report"
                        break

            if not download_url:
                # Try to find any download URLs in the raw content
                url_pattern = r'https?://[^\s<>"\']+(?:xlsx?|export|download|report)[^\s<>"\']*'
                urls = re.findall(url_pattern, email_content, re.IGNORECASE)
                if urls:
                    download_url = urls[0]
                    page_name = "extracted_report"

            if not download_url:
                logger.error(f"No download URL found in message {message_id}")
                raise NoDownloadUrlFound(f"No download URL found in message {message_id}")

            # Clean up page name
            page_name = re.sub(r'[^\w\-_.]', '_', page_name)[:50]  # Sanitize and limit length

            logger.debug(f"Extracted download URL: {download_url}")
            logger.debug(f"Extracted page name: {page_name}")

            return download_url, page_name

        except NoDownloadUrlFound:
            raise
        except Exception as e:
            logger.error(f"Failed to extract download link from message {message_id}: {e}")
            raise NoDownloadUrlFound(f"Link extraction failed: {e}")