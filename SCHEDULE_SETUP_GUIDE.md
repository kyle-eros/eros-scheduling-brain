# 📅 Dataform Daily Schedule Setup Guide
## For Philippines-Based Scheduler Team

## Overview
This guide will help you set up automatic daily execution of your EROS Dataform pipeline optimized for your Philippines-based scheduling team working primarily during 1 AM - 11 AM MST.

---

## 🚀 Quick Setup Steps

### Step 1: Navigate to Workflow Configuration
1. Open [Google Cloud Console](https://console.cloud.google.com)
2. Go to **BigQuery** → **Dataform**
3. Select your repository: `eros-data-pipe`
4. Click on **Workflow configurations** in the left sidebar

### Step 2: Create New Workflow Configuration
1. Click **"+ CREATE WORKFLOW CONFIGURATION"**
2. Enter the following details:

#### Basic Information
- **Name**: `daily_incremental_pipeline`
- **Display name**: `Daily EROS Pipeline`
- **Description**: `Incremental daily update for scheduler recommendations`

#### Schedule Settings (PRIMARY - for Philippines team)
- **Frequency**: Select **"Custom schedule"**
- **Cron expression**: `30 0 * * *` (12:30 AM MST daily)
- **Time zone**: `America/Denver` (Mountain Time - MST/MDT)
- **Why this time**: Data ready 2.5 hours before team starts at 3 AM MST

### Step 3: Configure Execution Settings

#### Compilation Settings
```yaml
Default Database: of-scheduler-proj
Default Schema: Leave blank
Default Location: US
Assertion Schema: eros_assertions
```

#### Variables (if needed)
```yaml
enable_strict_freshness: "false"
enable_partition_slo: "false"
```

### Step 4: Select Actions to Execute

Choose **"Select with tags"** and include:
- `messaging_stg`
- `ops_stg`
- `messaging_feat`
- `ops_feat`
- `messaging_mart`
- `ops_mart`
- `messaging_srv`

**Important**: Do NOT select "Run with full refresh" - keep incremental mode

### Step 5: Configure Invocation Settings
- ✅ **Run as service account**: Use default Dataform service account
- ✅ **Include dependencies**: Yes
- ✅ **Run assertions**: Yes (non-blocking mode)
- ⚠️ **Full refresh**: NO (keep unchecked)

### Step 6: Set Up Notifications (Optional)

#### Email Notifications
1. Click **"Add notification"**
2. Select **"Email"**
3. Enter: `kyle@erosops.com`
4. Choose: **"On failure only"**

#### Slack Notifications (Optional)
1. Click **"Add notification"**
2. Select **"Webhook"**
3. Configure your Slack webhook URL
4. Choose notification events

### Step 7: Review and Create
1. Review all settings
2. Click **"CREATE"**
3. The schedule will be created in **PAUSED** state

### Step 8: Enable the Schedule
1. Find your workflow in the list
2. Click the **three dots menu** (⋮)
3. Select **"Resume"** or **"Enable"**
4. Confirm the schedule is now **ACTIVE**

---

## 📊 Verifying the Schedule

### Check Schedule Status
```sql
-- Run this in BigQuery to verify latest execution
SELECT
  workflow_name,
  invocation_id,
  state,
  invocation_time,
  duration_seconds
FROM `region-us-central1.INFORMATION_SCHEMA.WORKFLOW_INVOCATIONS`
WHERE workflow_name = 'daily_incremental_pipeline'
ORDER BY invocation_time DESC
LIMIT 5;
```

### Manual Test Run
Before waiting for the scheduled run:
1. Go to your workflow configuration
2. Click **"EXECUTE"**
3. Select **"Execute with schedule settings"**
4. Monitor the execution

---

## 🔍 Monitoring Daily Executions

### Daily Health Check Query
```sql
-- Check if today's data was generated
SELECT
  'enhanced_daily_recommendations' as table_name,
  COUNT(*) as row_count,
  MAX(recommendation_date) as latest_date,
  CURRENT_DATE() = MAX(recommendation_date) as is_current
FROM `of-scheduler-proj.eros_messaging_mart.enhanced_daily_recommendations`
WHERE recommendation_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)

UNION ALL

SELECT
  'scheduler_dashboard' as table_name,
  COUNT(*) as row_count,
  MAX(recommendation_date) as latest_date,
  CURRENT_DATE() = MAX(recommendation_date) as is_current
FROM `of-scheduler-proj.eros_messaging_srv.scheduler_dashboard`
WHERE recommendation_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY);
```

### Set Up Monitoring Alert (Optional)
1. Go to **Cloud Monitoring**
2. Create new alert policy
3. Set condition:
   - Resource: Dataform workflow
   - Metric: Workflow execution failure
   - Threshold: Any failure
4. Add notification channel (email/Slack)

---

## ⏰ Schedule Times for Philippines Team

### Primary Schedule (RECOMMENDED)
| Schedule | Cron | MST Time | Philippines Time | Purpose |
|----------|------|----------|-----------------|----------|
| **PRIMARY** | `30 0 * * *` | 12:30 AM | 3:30 PM | Data ready before 1 AM MST early birds |
| **Optional Refresh** | `0 6 * * *` | 6:00 AM | 9:00 PM | Mid-shift update for late data |

### Team Working Hours Reference
| MST Time | Philippines Time (PHT) | Activity |
|----------|----------------------|----------|
| 1:00 AM | 4:00 PM | Early schedulers start |
| 3:00 AM | 6:00 PM | Main team starts shift |
| 6:00 AM | 9:00 PM | Mid-shift (optional refresh) |
| 11:00 AM | 2:00 AM (next day) | Team shift ends |

---

## 🛠️ Troubleshooting

### Common Issues and Solutions

#### Issue: Schedule doesn't run
- **Check**: Is the workflow configuration ACTIVE (not PAUSED)?
- **Check**: Are there any IAM permission issues?
- **Solution**: Ensure Dataform service account has BigQuery Data Editor role

#### Issue: Execution fails with partition errors
- **Check**: Review the error logs in Dataform UI
- **Solution**: Our fixes should handle this, but check `mass_messages.sqlx` pre_operations

#### Issue: No new data after successful run
- **Check**: Verify source tables have new data
- **Check**: Check incremental watermarks
- **Solution**: Run once with full refresh if needed

#### Issue: Execution takes too long
- **Check**: Execution logs for slow queries
- **Solution**: Consider optimizing large table scans or adjusting schedule time

---

## 📈 Success Metrics

Your daily pipeline is working correctly when:

✅ **Execution completes** by 12:45 AM MST (before 1 AM early birds)
✅ **No failed assertions** (or only expected ones)
✅ **Fresh data** in `scheduler_dashboard` with current date
✅ **Philippines team can access** recommendations when they start (1-3 AM MST)
✅ **Discord notification** confirms success (if configured)
✅ **No cost overruns** (stays under 10GB processed)

---

## 🔐 Security & Best Practices

1. **Service Account**: Use dedicated service account with minimal permissions
2. **Partition Filters**: Always maintained (our fixes ensure this)
3. **Cost Controls**: Set max bytes billed to prevent runaway queries
4. **Incremental Only**: Never use full refresh in scheduled runs
5. **Monitoring**: Set up alerts for failures and anomalies

---

## 📞 Support & Next Steps

### After Setup:
1. Monitor first few scheduled runs
2. Adjust schedule time based on team feedback
3. Set up additional monitoring if needed
4. Document any custom requirements

### Need Help?
- **Dataform Issues**: Check execution logs in Dataform UI
- **BigQuery Errors**: Review query logs in BigQuery
- **Schedule Problems**: Verify workflow configuration settings

---

## 📋 Checklist

Use this checklist to ensure everything is configured:

- [ ] Workflow configuration created
- [ ] Schedule time set (6:00 AM PST recommended)
- [ ] Tags selected (all production tags)
- [ ] Incremental mode (NOT full refresh)
- [ ] Assertions enabled
- [ ] Email notifications configured
- [ ] Schedule ACTIVATED (not paused)
- [ ] Test run successful
- [ ] Monitoring query saved
- [ ] Team notified of schedule

---

*Last updated: October 1, 2025*
*Pipeline version: eros-data-pipe v2.0*