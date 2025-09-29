#!/usr/bin/env python3
"""
Clean and prepare RENEW caption data for BigQuery loading
"""
import pandas as pd
import sys
from datetime import datetime

def clean_renew_data():
    # Read the raw RENEW CSV file
    df = pd.read_csv('/Users/kylemerriman/Desktop/eros-data-pipe/data/EROS SCHEDULING HUB Renew MASS MESSAGE .csv')

    # Create cleaned DataFrame with proper column mapping
    cleaned_df = pd.DataFrame()

    # Map columns to new schema
    cleaned_df['renew_campaign_id'] = df['Renew Campaign ID'].astype(str)
    cleaned_df['caption_text'] = df['Renewal Message']
    cleaned_df['caption_type'] = 'RENEW'
    cleaned_df['days_before_expiry'] = df['Days Before Expiry'].fillna(0).astype(int)
    cleaned_df['incentive_type'] = df['Incentive'].fillna('Renew campaign captions')
    cleaned_df['renewal_rate_percent'] = pd.to_numeric(df['Renewal Rate %'], errors='coerce')
    cleaned_df['ltv_impact_usd'] = pd.to_numeric(df['LTV Impact $'], errors='coerce')
    cleaned_df['best_time'] = df['Best Time']
    cleaned_df['urgency_level'] = df['Urgency Level']
    cleaned_df['page_type'] = df['Page Type']
    cleaned_df['last_used_days'] = pd.to_numeric(df['Last Used Days'], errors='coerce')
    cleaned_df['status'] = df['Status']
    cleaned_df['notes'] = df['Notes']

    # Add created timestamp (current time for existing data)
    cleaned_df['created_ts'] = datetime.now()

    # Remove rows with missing essential data
    cleaned_df = cleaned_df.dropna(subset=['renew_campaign_id', 'caption_text'])

    # Save cleaned data
    cleaned_df.to_csv('/Users/kylemerriman/Desktop/eros-data-pipe/data/cleaned_renew_captions.csv', index=False)
    print(f"Cleaned {len(cleaned_df)} RENEW captions")

if __name__ == "__main__":
    clean_renew_data()