#!/usr/bin/env python3
"""
Clean and prepare BUMP caption data for BigQuery loading
"""
import pandas as pd
import sys
from datetime import datetime

def clean_bump_data():
    # Read the raw BUMP CSV file
    df = pd.read_csv('/Users/kylemerriman/Desktop/eros-data-pipe/data/EROS CAPTION LOGGER- MASS MESSAGE  BUMPS.csv')

    # Create cleaned DataFrame with proper column mapping
    cleaned_df = pd.DataFrame()

    # Map columns to new schema
    cleaned_df['caption_id'] = df['ID']
    cleaned_df['caption_text'] = df['Preview']
    cleaned_df['caption_type'] = df['Type']
    cleaned_df['price_last_sent'] = 0.0  # BUMP messages are free
    cleaned_df['word_count'] = df['WordCount'].fillna(0).astype(int)
    cleaned_df['length_category'] = df['LengthCat']
    cleaned_df['best_time'] = df['BestTime']
    cleaned_df['theme_category'] = df['Theme | Tags']

    # Handle dates
    cleaned_df['last_used_date'] = pd.to_datetime(df['LastUsedDate'], errors='coerce').dt.date
    cleaned_df['last_used_by'] = df['LastUsedBy']
    cleaned_df['times_used'] = df['TimesUsed'].fillna(0).astype(int)
    cleaned_df['last_used_page'] = df['LastUsedPage']
    cleaned_df['explicitness_level'] = df['Explicitness']

    # Add created timestamp (current time for existing data)
    cleaned_df['created_ts'] = datetime.now()
    cleaned_df['status'] = 'ACTIVE'

    # Remove rows with missing essential data
    cleaned_df = cleaned_df.dropna(subset=['caption_id', 'caption_text'])

    # Save cleaned data
    cleaned_df.to_csv('/Users/kylemerriman/Desktop/eros-data-pipe/data/cleaned_bump_captions.csv', index=False)
    print(f"Cleaned {len(cleaned_df)} BUMP captions")

if __name__ == "__main__":
    clean_bump_data()