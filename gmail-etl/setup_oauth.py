#!/usr/bin/env python3
"""
Setup OAuth2 credentials for Gmail ETL
This will create user credentials that work without domain delegation
"""

import json
import os
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

# Gmail API scopes
SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.metadata'
]

def create_oauth_credentials():
    """Create OAuth2 credentials for Gmail access"""

    # You need to create OAuth2 credentials in Google Cloud Console
    # Go to APIs & Services > Credentials > Create Credentials > OAuth client ID
    # Choose "Desktop application"
    # Download the client_secret.json file

    print("🔑 Setting up OAuth2 credentials for Gmail...")
    print("")
    print("First, you need to create OAuth2 credentials:")
    print("1. Go to Google Cloud Console > APIs & Services > Credentials")
    print("2. Click 'Create Credentials' > 'OAuth client ID'")
    print("3. Choose 'Desktop application'")
    print("4. Name it 'Gmail ETL'")
    print("5. Download the client_secret.json file")
    print("6. Place it in this gmail-etl directory")
    print("")

    client_secrets_file = "client_secret.json"

    if not os.path.exists(client_secrets_file):
        print(f"❌ {client_secrets_file} not found!")
        print("Please download it from Google Cloud Console and try again.")
        return False

    print(f"✅ Found {client_secrets_file}")

    # Create the flow
    flow = InstalledAppFlow.from_client_secrets_file(
        client_secrets_file, SCOPES)

    # Run the OAuth flow
    print("🌐 Opening browser for OAuth authorization...")
    creds = flow.run_local_server(port=0)

    # Save credentials to a file
    token_file = "token.json"
    with open(token_file, 'w') as token:
        token.write(creds.to_json())

    print(f"✅ Credentials saved to {token_file}")

    # Test the credentials
    from googleapiclient.discovery import build
    service = build('gmail', 'v1', credentials=creds)
    profile = service.users().getProfile(userId='me').execute()

    print(f"🎉 Successfully authenticated as: {profile.get('emailAddress')}")

    # Show how to upload to Secret Manager
    print("")
    print("📤 To upload to Secret Manager, run:")
    print(f"gcloud secrets versions add gmail-etl --data-file={token_file}")

    return True

if __name__ == "__main__":
    create_oauth_credentials()