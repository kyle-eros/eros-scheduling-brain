# downloader.py
"""
File downloader for EROS Gmail ETL
Simplified version adapted from working python-etl
"""

import os
import logging
import requests
from typing import Optional
from pathlib import Path
from bs4 import BeautifulSoup
import time

from exceptions import InvalidFileError

logger = logging.getLogger(__name__)


def download_file(url: str, page_name: str, msg_id: str, temp_dir: str) -> str:
    """
    Download file from URL to temporary directory.
    Handles both direct downloads and download pages.

    Args:
        url: Download URL
        page_name: Page name for filename
        msg_id: Message ID for unique naming
        temp_dir: Temporary directory path

    Returns:
        Path to downloaded file

    Raises:
        Exception: If download fails
    """
    # Create safe filename
    safe_page_name = "".join(c for c in page_name if c.isalnum() or c in ('-', '_', '.'))
    if not safe_page_name:
        safe_page_name = "report"

    filename = f"{safe_page_name}_{msg_id}.xlsx"
    local_path = os.path.join(temp_dir, filename)

    logger.info(f"  📥 Downloading to: {local_path}")

    try:
        # Create session with proper headers to mimic browser
        session = requests.Session()
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        })

        # First, try the URL directly
        logger.debug(f"  Attempting direct download from: {url}")
        response = session.get(url, timeout=300, allow_redirects=True)
        response.raise_for_status()

        # Check if we got an Excel file directly
        content_type = response.headers.get('content-type', '').lower()
        content_disposition = response.headers.get('content-disposition', '')

        if ('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' in content_type or
            'application/vnd.ms-excel' in content_type or
            'application/octet-stream' in content_type or
            'attachment' in content_disposition):

            logger.debug(f"  Direct Excel download detected (content-type: {content_type})")
            return _save_response_to_file(response, local_path)

        # Check if response starts with ZIP header (XLSX files are ZIP archives)
        if response.content[:2] == b'PK':
            logger.debug(f"  Direct Excel download detected (ZIP header)")
            return _save_response_to_file(response, local_path)

        # If we got HTML, try to find the actual download link
        if ('text/html' in content_type or
            response.content.decode('utf-8', errors='ignore')[:100].lower().strip().startswith('<!doctype html')):

            logger.info(f"  HTML page detected, searching for download link...")

            # First check the final URL after redirects for query parameters
            final_url = response.url
            actual_download_url = _extract_download_url_from_html(response.content.decode('utf-8', errors='ignore'), final_url)

            if actual_download_url:
                logger.info(f"  Found download link: {actual_download_url}")
                # Try downloading from the actual URL
                response = session.get(actual_download_url, timeout=300, allow_redirects=True)
                response.raise_for_status()
                return _save_response_to_file(response, local_path)
            else:
                # Try common download URL patterns
                download_urls = _generate_download_url_variations(final_url)
                for download_url in download_urls:
                    try:
                        logger.debug(f"  Trying URL variation: {download_url}")
                        response = session.get(download_url, timeout=300, allow_redirects=True)
                        response.raise_for_status()

                        # Check if this looks like an Excel file
                        if (response.content[:2] == b'PK' or
                            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' in
                            response.headers.get('content-type', '')):
                            logger.info(f"  Successfully found Excel file at: {download_url}")
                            return _save_response_to_file(response, local_path)
                    except:
                        continue

        # If all else fails, save what we got and let validation catch the issue
        logger.warning(f"  Could not find Excel file, saving response as-is for debugging")
        return _save_response_to_file(response, local_path)

    except requests.exceptions.RequestException as e:
        logger.error(f"  ❌ Download failed: {e}")
        raise Exception(f"Download failed: {e}")
    except Exception as e:
        logger.error(f"  ❌ Download error: {e}")
        # Clean up partial file
        if os.path.exists(local_path):
            try:
                os.remove(local_path)
            except:
                pass
        raise


def _save_response_to_file(response: requests.Response, local_path: str) -> str:
    """Save HTTP response content to file"""
    with open(local_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)

    # Verify file was created and has content
    if not os.path.exists(local_path):
        raise Exception(f"File was not created: {local_path}")

    file_size = os.path.getsize(local_path)
    if file_size == 0:
        raise Exception(f"Downloaded file is empty: {local_path}")

    logger.info(f"  ✅ Downloaded {file_size:,} bytes")
    return local_path


def _extract_download_url_from_html(html_content: str, base_url: str) -> Optional[str]:
    """Extract actual download URL from HTML page"""
    try:
        # Look for URLs in query parameters first (most reliable for infloww)
        from urllib.parse import urlparse, parse_qs, unquote
        parsed_url = urlparse(base_url)
        query_params = parse_qs(parsed_url.query)

        # Check if there's a url parameter
        if 'url' in query_params:
            potential_url = unquote(query_params['url'][0])
            if any(ext in potential_url.lower() for ext in ['.xlsx', '.xls']):
                logger.debug(f"Found URL in query parameter: {potential_url}")
                return potential_url

        # Look for direct media URLs in the HTML content using regex
        import re

        # Look for infloww media URLs which are the actual file downloads
        media_urls = re.findall(r'https://media\.infloww\.com/[a-f0-9\-]+\.xlsx', html_content)
        if media_urls:
            logger.debug(f"Found media URL in HTML: {media_urls[0]}")
            return media_urls[0]

        # Look for any .xlsx/.xls URLs in the content
        excel_urls = re.findall(r'https?://[^\s\'"<>]+\.xlsx?', html_content)
        if excel_urls:
            # Filter out the sendgrid tracking URLs
            for url in excel_urls:
                if 'sendgrid.net' not in url and 'media.infloww.com' in url:
                    logger.debug(f"Found Excel URL: {url}")
                    return url

        # Parse with BeautifulSoup as fallback
        soup = BeautifulSoup(html_content, 'html.parser')

        # Look for direct download links
        for link in soup.find_all('a', href=True):
            href = link['href']

            # Check for Excel file extensions
            if any(ext in href.lower() for ext in ['.xlsx', '.xls']):
                return _resolve_url(href, base_url)

            # Check for download attributes or text
            if (link.get('download') or
                any(keyword in link.get_text().lower() for keyword in ['download', 'export', 'excel'])):
                return _resolve_url(href, base_url)

        # Look for JavaScript-triggered downloads
        scripts = soup.find_all('script')
        for script in scripts:
            if script.string:
                # Look for URLs in JavaScript that might be download links
                urls = re.findall(r'https?://[^\s\'"]+\.xlsx?', script.string)
                if urls:
                    return urls[0]

        return None
    except Exception as e:
        logger.debug(f"Error extracting download URL from HTML: {e}")
        return None


def _generate_download_url_variations(original_url: str) -> list:
    """Generate common download URL variations"""
    variations = []

    # If it's an infloww.com URL, try common patterns
    if 'infloww.com' in original_url:
        # Try adding /download to the end
        if not original_url.endswith('/download'):
            variations.append(original_url.rstrip('/') + '/download')

        # Try replacing /view with /download
        if '/view' in original_url:
            variations.append(original_url.replace('/view', '/download'))

        # Try adding export parameter
        separator = '&' if '?' in original_url else '?'
        variations.append(f"{original_url}{separator}export=true")
        variations.append(f"{original_url}{separator}format=xlsx")

    return variations


def _resolve_url(url: str, base_url: str) -> str:
    """Resolve relative URL to absolute URL"""
    from urllib.parse import urljoin
    return urljoin(base_url, url)


def validate_excel_file(file_path: str) -> bool:
    """
    Validate that file is a proper Excel file

    Args:
        file_path: Path to file to validate

    Returns:
        True if valid Excel file, False otherwise
    """
    try:
        file_path_obj = Path(file_path)

        # Check file exists
        if not file_path_obj.exists():
            logger.error(f"File does not exist: {file_path}")
            return False

        # Check file size
        file_size = file_path_obj.stat().st_size
        if file_size == 0:
            logger.error(f"File is empty: {file_path}")
            return False

        if file_size < 100:  # Very small files are likely not valid Excel
            logger.error(f"File too small ({file_size} bytes): {file_path}")
            return False

        # Check file extension
        if file_path_obj.suffix.lower() not in ['.xlsx', '.xls']:
            logger.error(f"Invalid file extension: {file_path_obj.suffix}")
            return False

        # Try to read first few bytes to check Excel magic numbers
        with open(file_path, 'rb') as f:
            header = f.read(512)  # Read more bytes to detect HTML

        # Check for HTML content first (common issue)
        header_text = header.decode('utf-8', errors='ignore').lower()
        if any(html_marker in header_text for html_marker in ['<!doctype html', '<html', '<head>', '<body>']):
            logger.error(f"File appears to be HTML, not Excel: {file_path}")
            return False

        # Excel files should start with specific magic numbers
        # XLSX files are ZIP archives, so check for ZIP header
        if header[:2] == b'PK':  # ZIP header (XLSX)
            logger.debug(f"Valid XLSX file: {file_path}")
            return True
        elif header[:8] == b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1':  # OLE header (XLS)
            logger.debug(f"Valid XLS file: {file_path}")
            return True
        else:
            logger.error(f"Invalid Excel file format: {file_path}")
            return False

    except Exception as e:
        logger.error(f"Error validating file {file_path}: {e}")
        return False