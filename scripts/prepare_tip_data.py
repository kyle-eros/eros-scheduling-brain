#!/usr/bin/env python3
"""
Clean and prepare TIP caption data for BigQuery loading
"""
import pandas as pd
import sys
from datetime import datetime

def clean_tip_data():
    # Read the raw TIP CSV file
    df = pd.read_csv('/Users/kylemerriman/Desktop/eros-data-pipe/data/EROS SCHEDULING HUB  TIP Captions WallPost:MassMessage.csv')

    # Create cleaned DataFrame with proper column mapping
    cleaned_df = pd.DataFrame()

    # Map columns to new schema
    cleaned_df['tip_campaign_id'] = df['Tip Campaign ID'].astype(str)
    cleaned_df['campaign_style'] = df['Campaign Style']
    cleaned_df['caption_text'] = df['Campaign Style']  # Using campaign style as caption text since that's the actual content
    cleaned_df['caption_type'] = 'TIP'
    cleaned_df['tip_amount'] = pd.to_numeric(df['Tip Amount'].str.replace('$', ''), errors='coerce').fillna(0.0)
    cleaned_df['reward_offered'] = df['Reward Offered']
    cleaned_df['tip_rate_percent'] = pd.to_numeric(df['Tip Rate %'], errors='coerce')
    cleaned_df['avg_tip_usd'] = pd.to_numeric(df['Avg Tip $'], errors='coerce')
    cleaned_df['total_revenue_usd'] = pd.to_numeric(df['Total Revenue $'], errors='coerce')
    cleaned_df['best_day_time'] = df['Best Day/Time']
    cleaned_df['engagement_score'] = pd.to_numeric(df['Engagement Score'], errors='coerce')
    cleaned_df['last_used_days'] = pd.to_numeric(df['Last Used Days'], errors='coerce')
    cleaned_df['status'] = df['Status']
    cleaned_df['notes'] = df['Notes']

    # Add created timestamp (current time for existing data)
    cleaned_df['created_ts'] = datetime.now()

    # Remove rows with missing essential data
    cleaned_df = cleaned_df.dropna(subset=['tip_campaign_id', 'caption_text'])

    # Save cleaned data
    cleaned_df.to_csv('/Users/kylemerriman/Desktop/eros-data-pipe/data/cleaned_tip_captions.csv', index=False)
    print(f"Cleaned {len(cleaned_df)} TIP captions")

if __name__ == "__main__":
    clean_tip_data()