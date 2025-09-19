#!/usr/bin/env python3
"""
Quick test to try different authentication approaches
"""

import logging
from google.cloud import secretmanager
from google.oauth2 import service_account
from googleapiclient.discovery import build
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_service_account_direct():
    """Test using service account without delegation"""

    try:
        # Get service account from Secret Manager
        client = secretmanager.SecretManagerServiceClient()
        secret_name = "projects/of-scheduler-proj/secrets/gmail-etl/versions/latest"
        response = client.access_secret_version(request={"name": secret_name})
        secret_data = response.payload.data.decode("UTF-8")

        # Create service account credentials
        service_account_info = json.loads(secret_data)

        scopes = [
            'https://www.googleapis.com/auth/gmail.readonly'
        ]

        credentials = service_account.Credentials.from_service_account_info(
            service_account_info,
            scopes=scopes
        )

        # Create delegated credentials
        delegated_credentials = credentials.with_subject('kyle@erosops.com')

        print(f"Service Account Email: {service_account_info.get('client_email')}")

        # Try to build Gmail service
        service = build('gmail', 'v1', credentials=delegated_credentials)

        # Test with different approaches
        print("Testing different user IDs...")

        # Try 1: Use target user
        try:
            profile = service.users().getProfile(userId='kyle@erosops.com').execute()
            print(f"✅ SUCCESS with target user: {profile.get('emailAddress')}")
            return service, 'kyle@erosops.com'
        except Exception as e:
            print(f"❌ Failed with target user: {e}")

        # Try 2: Use 'me'
        try:
            profile = service.users().getProfile(userId='me').execute()
            print(f"✅ SUCCESS with 'me': {profile.get('emailAddress')}")
            return service, 'me'
        except Exception as e:
            print(f"❌ Failed with 'me': {e}")

        print("❌ All authentication methods failed")
        return None, None

    except Exception as e:
        print(f"💥 Error: {e}")
        return None, None

if __name__ == "__main__":
    print("🧪 Testing service account authentication approaches...")
    service, user_id = test_service_account_direct()

    if service and user_id:
        print(f"\n🎉 SUCCESS! Use user_id: {user_id}")

        # Try to list some messages
        try:
            query = 'from:no-reply@infloww.com subject:"OF mass message history report is ready for download"'
            results = service.users().messages().list(
                userId=user_id,
                q=query,
                maxResults=5
            ).execute()

            messages = results.get('messages', [])
            print(f"✅ Found {len(messages)} messages")

            if messages:
                print("✅ Gmail ETL can work with this authentication!")
            else:
                print("⚠️  No messages found (but authentication works)")

        except Exception as e:
            print(f"❌ Message listing failed: {e}")
    else:
        print("\n💔 Authentication failed completely")
        print("You'll need to either:")
        print("1. Enable domain-wide delegation for the service account")
        print("2. Create OAuth2 user credentials instead")