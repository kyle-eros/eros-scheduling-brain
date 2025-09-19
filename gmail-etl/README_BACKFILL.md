# 🔄 EROS Gmail ETL - Backfill Guide

## Overview

The EROS Gmail ETL now supports **full backfill mode** to grab ALL relevant OnlyFans report emails from your inbox, ignoring any previously processed message state. This is perfect for:

- **Initial setup**: Getting all historical data into your EROS system
- **Data recovery**: Re-processing emails after system changes
- **Migration**: Moving from old ETL to new EROS-integrated pipeline

## 🚀 Quick Start - Full Backfill

### Option 1: Interactive Script (Recommended)
```bash
cd gmail-etl
./run_backfill.sh
```

### Option 2: Direct Command
```bash
python main.py --full --max-messages 2000
```

### Option 3: Custom Limits
```bash
# Process up to 5000 messages
python main.py --full --max-messages 5000

# With debug logging
python main.py --full --max-messages 1000 --log-level DEBUG
```

## 📊 Mode Comparison

| Feature | **Incremental Mode** | **Full Backfill Mode** |
|---------|---------------------|-------------------------|
| **Command** | `python main.py` | `python main.py --full` |
| **State File** | ✅ Respects processed_emails.json | ❌ Ignores all previous state |
| **Gmail Query** | `newer_than:7d` limit | 🔄 Removes date restrictions |
| **Message Limit** | 5 messages (conservative) | 1000+ messages (configurable) |
| **Duration** | ~30 seconds | 10-60 minutes |
| **Use Case** | Daily scheduled runs | One-time historical import |

## 🔧 How It Works

### Normal Incremental Mode
```bash
python main.py
```
1. ✅ Loads `processed_emails.json` state file
2. ✅ Uses search query: `"...newer_than:7d"`
3. ✅ Skips already processed message IDs
4. ✅ Processes max 5 new messages
5. ✅ Updates state file with new processed IDs

### Full Backfill Mode
```bash
python main.py --full
```
1. 🔄 **IGNORES** `processed_emails.json` state file
2. 🔄 Uses search query: `"..."` (removes `newer_than` restriction)
3. 🔄 Processes ALL matching emails (up to limit)
4. 🔄 Processes max 1000+ messages (configurable)
5. ✅ Creates NEW state file with all processed IDs

## 📍 EROS System Integration

### BigQuery Destination
```
Project: of-scheduler-proj
Dataset: eros_source
Table:   mass_message_daily_final
```

### Schema Alignment
- ✅ **Deduplication**: Matches Dataform `FARM_FINGERPRINT(CONCAT(message_id, '_', source_file))`
- ✅ **Column Names**: `message` → `message_text` for Dataform compatibility
- ✅ **Currency Fields**: Raw strings with `$` for Dataform regex parsing
- ✅ **Type Safety**: All data types match BigQuery schema

### Dataform Integration
After backfill, your Dataform pipeline will automatically:
1. Process new data in `eros_source.mass_message_daily_final`
2. Apply deduplication in `definitions/messaging/stg/mass_messages.sqlx`
3. Enrich data through the complete EROS pipeline
4. Generate recommendations in `definitions/messaging/mart/daily_recommendations.sqlx`

## ⚠️ Important Considerations

### Gmail API Limits
- **Daily Quota**: 1 billion quota units (plenty for backfill)
- **Rate Limits**: 250 quota units/user/second
- **Best Practice**: Use `--max-messages` to control batch size

### Processing Time
| Messages | Estimated Time |
|----------|----------------|
| 100 messages | 5-10 minutes |
| 500 messages | 20-30 minutes |
| 1000+ messages | 45-90 minutes |

### Storage Impact
- **BigQuery**: ~1KB per message row
- **GCS Backup**: ~50KB per Excel file
- **State File**: ~100 bytes per processed message ID

## 🔍 Monitoring & Troubleshooting

### Real-time Monitoring
```bash
# Watch logs in real-time
tail -f gmail_etl_*.log

# Monitor BigQuery table
bq query --use_legacy_sql=false '
SELECT COUNT(*) as total_rows,
       COUNT(DISTINCT message_id) as unique_messages,
       MAX(loaded_at) as last_loaded
FROM `of-scheduler-proj.eros_source.mass_message_daily_final`
'
```

### Common Issues

#### Authentication Errors
```bash
# Check service account
gcloud auth list

# Test BigQuery access
bq ls eros_source

# Test GCS access
gsutil ls gs://eros-data-pipe-state/
```

#### Memory Issues (Large Backfills)
```bash
# Process in smaller batches
python main.py --full --max-messages 250
python main.py --full --max-messages 250  # Run again
```

#### Duplicate Data
The ETL automatically handles duplicates via:
1. **Message-level deduplication**: Based on Gmail message IDs
2. **Row-level deduplication**: Based on surrogate keys
3. **Dataform deduplication**: Final cleanup in staging layer

## 🚀 Production Deployment

### After Successful Backfill

1. **Verify Data Quality**
   ```sql
   SELECT COUNT(*) FROM `of-scheduler-proj.eros_source.mass_message_daily_final`;
   ```

2. **Run Dataform Pipeline**
   ```bash
   dataform run
   ```

3. **Deploy Cloud Run Job**
   ```bash
   ./deploy.sh
   ```

4. **Schedule Incremental Runs**
   - Cloud Run will use normal incremental mode
   - Processes only new emails
   - Respects the state file created by backfill

### Cloud Run Configuration
```yaml
# Incremental mode for production
env:
  - name: MAX_MESSAGES_PER_RUN
    value: "5"
  - name: LOG_LEVEL
    value: "INFO"
# No --full flag in production
```

## 📚 Examples

### Complete Backfill Workflow
```bash
# 1. Run backfill (interactive)
./run_backfill.sh

# 2. Verify data loaded
bq query --use_legacy_sql=false '
SELECT COUNT(*) as rows FROM `of-scheduler-proj.eros_source.mass_message_daily_final`
'

# 3. Run Dataform to process data
dataform run

# 4. Deploy for ongoing incremental processing
./deploy.sh
```

### Testing Scenarios
```bash
# Test with small batch first
python main.py --full --max-messages 10

# Full production backfill
python main.py --full --max-messages 2000

# Custom date range (manual query modification)
# Edit config.py to add custom date filters if needed
```

## 🎯 Success Criteria

After successful backfill, you should see:

✅ **BigQuery Table**: Thousands of rows in `eros_source.mass_message_daily_final`
✅ **State File**: Complete `processed_emails.json` in GCS
✅ **Dataform Ready**: Pipeline can process historical + new data
✅ **No Duplicates**: Clean deduplication across all data
✅ **Future Incremental**: Cloud Run only processes new emails

---

**🎉 Your EROS Intelligence Engine is now fully backfilled and ready for production!**