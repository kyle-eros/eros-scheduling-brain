#!/usr/bin/env python3
"""
Script to insert new captions into BigQuery caption banks while avoiding duplicates
"""
import csv
import re
import uuid
from datetime import datetime
from google.cloud import bigquery

def clean_caption(text):
    """Clean and normalize caption text"""
    # Remove sender info patterns
    text = re.sub(r'^[^—]*—[^,]*,\s*\d+/\d+/\d+,\s*\d+:\d+\s*(AM|PM)\s*', '', text)
    # Remove quotes if they wrap the entire text
    text = text.strip('"')
    # Remove dash separators
    text = re.sub(r'^-+$', '', text.strip())
    # Skip empty lines or metadata
    if not text or text in ['', '-', '-------------'] or 'kyle —' in text.lower() or any(name in text.lower() for name in ['sugokie —', 'monalisa —', 'rubi 💎']):
        return None
    return text.strip()

def load_captions_from_file(file_path):
    """Load and clean captions from CSV file"""
    captions = []
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        lines = content.split('\n')

    for line in lines:
        cleaned = clean_caption(line)
        if cleaned and len(cleaned) > 10:  # Only keep substantial captions
            captions.append(cleaned)

    return captions

def get_existing_captions(client, table_id):
    """Get existing captions from BigQuery table to check for duplicates"""
    query = f"SELECT LOWER(TRIM(caption_text)) as caption_text FROM `{table_id}`"
    results = client.query(query)
    return {row.caption_text for row in results}

def insert_captions(client, table_id, captions, caption_type, existing_captions):
    """Insert new captions into BigQuery table"""
    new_captions = []
    duplicate_count = 0

    for caption_text in captions:
        normalized_text = caption_text.lower().strip()
        if normalized_text not in existing_captions:
            new_captions.append({
                'caption_id': str(uuid.uuid4()),
                'caption_text': caption_text,
                'caption_type': caption_type,
                'created_ts': datetime.utcnow().isoformat()
            })
        else:
            duplicate_count += 1

    if new_captions:
        table = client.get_table(table_id)
        errors = client.insert_rows_json(table, new_captions)
        if errors:
            print(f"Error inserting captions: {errors}")
            return False
        else:
            print(f"Successfully inserted {len(new_captions)} new {caption_type} captions")
            print(f"Skipped {duplicate_count} duplicates")
            return True
    else:
        print(f"No new captions to insert for {caption_type} (all {len(captions)} were duplicates)")
        return True

def main():
    # Initialize BigQuery client
    client = bigquery.Client()
    project_id = "of-scheduler-proj"

    # Define file paths and corresponding tables
    file_configs = [
        {
            'file_path': '/Users/kylemerriman/Downloads/Untitled spreadsheet - bundle captions.csv',
            'table_id': f'{project_id}.eros_source.caption_bank_ppv_final',
            'caption_type': 'PPV'
        },
        {
            'file_path': '/Users/kylemerriman/Downloads/Untitled spreadsheet - PPV captions.csv',
            'table_id': f'{project_id}.eros_source.caption_bank_ppv_final',
            'caption_type': 'PPV'
        },
        {
            'file_path': '/Users/kylemerriman/Downloads/Untitled spreadsheet - Tip wall post captions.csv',
            'table_id': f'{project_id}.eros_source.caption_bank_tip_final',
            'caption_type': 'TIP'
        },
        {
            'file_path': '/Users/kylemerriman/Downloads/Untitled spreadsheet - renew captions.csv',
            'table_id': f'{project_id}.eros_source.caption_bank_renew_final',
            'caption_type': 'RENEW'
        }
    ]

    # Process each file
    for config in file_configs:
        print(f"\n=== Processing {config['caption_type']} captions ===")

        # Load captions from file
        captions = load_captions_from_file(config['file_path'])
        print(f"Loaded {len(captions)} captions from {config['file_path']}")

        # Get existing captions to check for duplicates
        print("Checking for existing captions...")
        existing_captions = get_existing_captions(client, config['table_id'])
        print(f"Found {len(existing_captions)} existing captions in table")

        # Insert new captions
        success = insert_captions(
            client,
            config['table_id'],
            captions,
            config['caption_type'],
            existing_captions
        )

        if not success:
            print(f"Failed to insert {config['caption_type']} captions")
            return False

    print("\n=== Caption insertion complete! ===")
    return True

if __name__ == "__main__":
    main()