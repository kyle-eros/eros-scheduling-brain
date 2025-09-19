#!/usr/bin/env python3
"""
Test authentication to see exactly what's failing
"""

import sys
import logging
from config import Config
from auth import get_gmail_service, test_gmail_connection

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def main():
    """Test Gmail authentication"""
    try:
        config = Config()

        print("🧪 Testing Gmail authentication...")
        print(f"Project: {config.PROJECT_ID}")
        print(f"Target user: {config.TARGET_GMAIL_USER}")
        print(f"Secret name: {config.GMAIL_SA_SECRET_NAME}")

        # Test connection
        success = test_gmail_connection(config)

        if success:
            print("✅ Authentication successful!")
            return 0
        else:
            print("❌ Authentication failed")
            return 1

    except Exception as e:
        print(f"💥 Error: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())