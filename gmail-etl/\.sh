#!/bin/bash
# EROS Gmail ETL - Full Backfill Runner
# This script runs a complete backfill of all Gmail messages

set -e

echo "🚀 EROS Gmail ETL - Full Backfill Mode"
echo "======================================="
echo ""
echo "This will:"
echo "  ✅ IGNORE all previously processed messages"
echo "  ✅ Process ALL OnlyFans report emails in your inbox"
echo "  ✅ Save all data to BigQuery: eros_source.mass_message_daily_final"
echo "  ✅ Create new state file for future incremental runs"
echo ""
echo "⚠️  WARNING: This may process hundreds of emails and take 30+ minutes!"
echo ""

# Check if user wants to continue
read -p "Continue with full backfill? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Backfill cancelled."
    exit 0
fi

echo ""
echo "🔄 Starting full backfill..."
echo ""

# Set environment variables for production
export PROJECT_ID="of-scheduler-proj"
export BQ_DATASET="eros_source"
export BQ_TABLE="mass_message_daily_final"
export TARGET_GMAIL_USER="kyle@erosops.com"
export GMAIL_SA_SECRET_NAME="gmail-etl"
export STATE_BUCKET="eros-data-pipe-state"
export GCS_RAW_BUCKET="eros-report-files-raw-2025"
export LOG_LEVEL="INFO"

# Check if we're in the right directory
if [[ ! -f "main.py" ]]; then
    echo "❌ Error: main.py not found. Please run this script from the gmail-etl directory."
    exit 1
fi

# Check if virtual environment exists and activate it
if [[ -f "venv/bin/activate" ]]; then
    echo "🐍 Activating virtual environment..."
    source venv/bin/activate
elif [[ -f "../venv/bin/activate" ]]; then
    echo "🐍 Activating virtual environment..."
    source ../venv/bin/activate
else
    echo "⚠️  No virtual environment found, using system Python"
fi

# Install requirements if needed
if [[ -f "requirements.txt" ]]; then
    echo "📦 Installing/updating requirements..."
    pip install -r requirements.txt > /dev/null 2>&1
fi

# Run the backfill with high message limit
echo "🚀 Running full backfill with 2000 message limit..."
echo "   Target: $BQ_DATASET.$BQ_TABLE"
echo "   Gmail: $TARGET_GMAIL_USER"
echo ""

# Execute the backfill
python main.py --full --max-messages 2000 --log-level INFO

BACKFILL_EXIT_CODE=$?

echo ""
if [[ $BACKFILL_EXIT_CODE -eq 0 ]]; then
    echo "✅ BACKFILL COMPLETED SUCCESSFULLY!"
    echo ""
    echo "📊 Next steps:"
    echo "   1. Check BigQuery table: $BQ_DATASET.$BQ_TABLE"
    echo "   2. Run your Dataform pipeline to process the new data"
    echo "   3. Future runs will be incremental (only new emails)"
    echo ""
    echo "🔄 To run future incremental updates:"
    echo "   python main.py"
    echo ""
    echo "☁️  To deploy to Cloud Run for automated runs:"
    echo "   ./deploy.sh"
else
    echo "❌ BACKFILL FAILED with exit code: $BACKFILL_EXIT_CODE"
    echo ""
    echo "🔍 Check the logs above for error details"
    echo "🛠️  Common fixes:"
    echo "   - Ensure Gmail API credentials are configured"
    echo "   - Check BigQuery permissions"
    echo "   - Verify GCS bucket access"
    exit $BACKFILL_EXIT_CODE
fi