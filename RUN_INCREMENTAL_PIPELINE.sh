#!/bin/bash
# INCREMENTAL DATAFORM PIPELINE RUN
# Generated: 2025-10-01
# Purpose: Run incremental updates to generate today's scheduling data

echo "========================================="
echo "EROS DATAFORM INCREMENTAL PIPELINE"
echo "========================================="
echo ""
echo "This script will run the Dataform pipeline INCREMENTALLY"
echo "to generate today's (Oct 1, 2025) scheduling data."
echo ""
echo "Key fixes applied:"
echo "✅ mass_messages.sqlx - Added pre/post operations to handle partition filter"
echo "✅ scheduler_overrides_ext.sqlx - Added clustering alignment in post_operations"
echo "✅ Re-enabled data quality assertions with proper date filters"
echo ""
echo "========================================="
echo ""

# Step 1: Compile to verify everything is ready
echo "Step 1: Compiling Dataform configuration..."
npx @dataform/cli compile

if [ $? -ne 0 ]; then
    echo "❌ Compilation failed. Please fix errors before running."
    exit 1
fi

echo "✅ Compilation successful!"
echo ""

# Step 2: Run incremental pipeline (NOT full refresh)
echo "Step 2: Running incremental pipeline..."
echo "This will:"
echo "- Process new mass messages with 14-day watermark"
echo "- Update scheduler dashboard view"
echo "- Generate today's recommendations"
echo ""

# Run without --full-refresh to preserve historical data
npx @dataform/cli run \
    --timeout 600 \
    --tags messaging_stg,ops_stg,messaging_feat,ops_feat,messaging_mart,ops_mart,messaging_srv

if [ $? -ne 0 ]; then
    echo "❌ Pipeline run failed. Check logs for details."
    exit 1
fi

echo ""
echo "✅ Pipeline completed successfully!"
echo ""

# Step 3: Run assertions to verify data quality
echo "Step 3: Running data quality assertions..."
npx @dataform/cli run \
    --actions "eros_assertions.*" \
    --include-dependents false

echo ""
echo "========================================="
echo "PIPELINE COMPLETE!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Check scheduler_dashboard in BigQuery"
echo "2. Verify today's recommendations are generated"
echo "3. Test in Google Sheets Hub"
echo ""
echo "BigQuery query to verify:"
echo "SELECT COUNT(*) as recommendation_count,"
echo "       MIN(recommendation_date) as earliest_date,"
echo "       MAX(recommendation_date) as latest_date"
echo "FROM \`of-scheduler-proj.eros_messaging_mart.enhanced_daily_recommendations\`"
echo "WHERE recommendation_date = CURRENT_DATE();"