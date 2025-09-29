#!/bin/bash
# Complete tier system setup after Dataform deployment
set -e

echo "🚀 Starting complete tier system setup..."

echo "1. Inserting sample data for tier system..."
bq query --use_legacy_sql=false < insert_tier_sample_data.sql

echo "2. Verifying tier tables have data..."
echo "   - creator_page_assignments:"
bq query --use_legacy_sql=false --max_rows=1 'SELECT COUNT(*) FROM `of-scheduler-proj.eros_messaging_feat.creator_page_assignments`'

echo "   - creator_tier_assignments:"
bq query --use_legacy_sql=false --max_rows=1 'SELECT COUNT(*) FROM `of-scheduler-proj.eros_messaging_feat.creator_tier_assignments`'

echo "   - daily_recommendations:"
bq query --use_legacy_sql=false --max_rows=1 'SELECT COUNT(*) FROM `of-scheduler-proj.eros_messaging_mart.daily_recommendations` WHERE recommendation_date >= CURRENT_DATE()'

echo "3. Testing dashboard query..."
bq query --use_legacy_sql=false --max_rows=3 "
WITH scheduler_assignments AS (
  SELECT DISTINCT username_std, page_handle
  FROM \`of-scheduler-proj.eros_source.scheduler_assignments\`
  WHERE LOWER(scheduler_code) = LOWER('PAM')
)
SELECT
  dr.username_std as creator_id,
  DATE(dr.recommended_send_ts) as plan_date,
  FORMAT_TIMESTAMP('%H:%M', dr.recommended_send_ts) AS hhmm,
  dr.page_handle,
  dr.page_type,
  dr.full_tier_assignment,
  dr.messaging_strategy,
  dr.suggested_price as recommended_price_usd,
  dr.daily_limit
FROM \`of-scheduler-proj.eros_messaging_mart.daily_recommendations\` dr
INNER JOIN scheduler_assignments sa ON dr.page_handle = sa.page_handle
WHERE dr.recommendation_date >= CURRENT_DATE()
  AND dr.recommendation_date <= DATE_ADD(CURRENT_DATE(), INTERVAL 6 DAY)
ORDER BY dr.page_handle, dr.recommended_send_ts
LIMIT 3"

echo "✅ Tier system setup complete!"
echo "🎯 Dashboard should now work perfectly!"
echo ""
echo "Next steps:"
echo "1. Go to your Google Sheets dashboard"
echo "2. Click 'Load My Week' - should work without errors"
echo "3. Test other dashboard functions"
