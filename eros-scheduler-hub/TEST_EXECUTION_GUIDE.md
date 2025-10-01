# 🧪 EROS Scheduler Hub v2 - Automated UI Test Execution Guide

**Date:** October 1, 2025
**Test Function:** `runAutomatedTests()`
**Status:** ✅ **READY TO EXECUTE**

---

## 🚀 How to Run the Automated Tests

### Option 1: Via Google Sheets Menu (Recommended)

1. **Open the Google Sheet**
   ```
   https://drive.google.com/open?id=1PyY5KUxkGm5DPdgBmptJZJCcV21609PI--J0pvUU3Mc
   ```

2. **Click the Menu**
   - **🚀 EROS Scheduler Hub** → **🧪 Run Automated Tests**

3. **Wait for Completion**
   - A dialog box will appear with test results (30-60 seconds)
   - All results are displayed in one output

4. **Copy the Results**
   - Copy the entire test output from the dialog
   - Paste into a file or share with me

---

### Option 2: Via Apps Script Editor

1. **Open the Apps Script Editor**
   ```
   https://script.google.com/d/13pm47N8SmfuX47HnHc9uUK-0zKgMVtnaOQI946tIgQPTk78ECNptJ4dB/edit
   ```

2. **Select Function**
   - In the toolbar dropdown, select: `runAutomatedTests`

3. **Click Run** ▶️
   - Authorize if prompted
   - Watch the execution log at the bottom

4. **View Logs**
   - Click **View** → **Logs** or **Executions**
   - Copy the test output

---

## 📋 What the Tests Check

### TEST 1: Sheet Structure ✅
- Verifies all 7 required sheets exist:
  - Control Hub
  - Today Planner
  - Week View
  - Risk Console
  - Performance Pulse
  - Action Log
  - Diagnostics

### TEST 2: Core Functions ✅
- Executes and validates:
  - `renderToday()` - Load today's recommendations
  - `renderWeek()` - Load week view
  - `renderPerformance()` - Load performance metrics
  - `renderLogs()` - Load action log

### TEST 3: Data Validation ✅
- Checks Today Planner has data rows
- Verifies columns are populated:
  - Time column
  - Creator column
  - Price column

### TEST 4: Preflight Checks ✅
- Runs `runPreflight()` validation
- Verifies Diagnostics sheet created
- Counts issues found (spacing, fatigue, prices)

### TEST 5: Caption System ✅
- Tests `getCaptions()` for sample creator (alex_love)
- Validates caption source and confidence
- Confirms partition filter fix works

### TEST 6: Identity & RBAC ✅
- Resolves current user identity
- Displays scheduler code and email
- Checks manager permissions

### TEST 7: Override Service ✅
- Tests manager privilege check
- Validates override system ready

---

## 📊 Expected Output Format

```
TEST 1: Verify sheet structure
  ✅ Sheet "Control Hub" exists
  ✅ Sheet "Today Planner" exists
  ✅ Sheet "Week View" exists
  ✅ Sheet "Risk Console" exists
  ✅ Sheet "Performance Pulse" exists
  ✅ Sheet "Action Log" exists
  ✅ Sheet "Diagnostics" exists

TEST 2: Execute core functions
  ✅ renderToday() - Today planner refreshed.
  ✅ renderWeek() - Week view refreshed.
  ✅ renderPerformance() - Performance metrics refreshed.
  ✅ renderLogs() - Recent action log refreshed.

TEST 3: Validate data loaded
  ✅ Today Planner has 8 data rows
  ✅ Time column populated
  ✅ Creator column populated
  ✅ Price column populated

TEST 4: Run preflight checks
  ✅ runPreflight() - Preflight complete. Check Diagnostics sheet.
  ✅ Diagnostics sheet populated with 1 issues

TEST 5: Caption suggestion system
  ✅ getCaptions() returned 10 results for alex_love
  ✅ Caption source: 24H, confidence: HIGH

TEST 6: User identity and permissions
  ✅ Identity resolved: Kyle Merriman (kyle@erosops.com)
  ✅ Scheduler code: KYLE
  ✅ Manager status: true

TEST 7: Override service checks
  ✅ Manager check: true

⏱️ Total test duration: 45.23s

✅ Automated UI tests complete!
```

---

## ❌ Possible Error Scenarios

### Error: "No scheduler assignment found"
**Cause:** Your email not in `scheduler_roster` or `scheduler_assignments`
**Fix:** Run this SQL to add yourself:
```sql
INSERT `of-scheduler-proj.eros_source.scheduler_roster`
  (scheduler_code, scheduler_email, display_name, is_manager)
VALUES
  ('KYLE', 'kyle@erosops.com', 'Kyle Merriman', TRUE);
```

### Error: "Cannot query over table without partition filter"
**Cause:** Caption tables require `slot_dt_local` filter
**Status:** Should be FIXED in this deployment
**Verify:** Check TEST 5 passes without errors

### Error: "BigQuery quota exceeded"
**Cause:** Too many API calls in short time
**Fix:** Wait 60 seconds and run again

### Error: "Authorization required"
**Cause:** OAuth scopes changed
**Fix:** Reauthorize:
1. Extensions → Apps Script → Authorize
2. Accept all requested permissions

---

## 🐛 Troubleshooting

### Tests Run But Show No Output
**Solution:** Check Apps Script execution log:
1. Apps Script Editor → View → Executions
2. Find most recent execution
3. Click to see full output

### Tests Timeout
**Solution:** Increase Apps Script quota or run tests individually:
```javascript
// In Apps Script console, run one at a time:
renderToday()
renderWeek()
runPreflight()
```

### Some Tests Fail
**Expected:** If no data exists for today (Oct 1), TEST 3 may show:
```
⚠️ Today Planner has no data rows (check if today has recommendations)
```
This is NORMAL if `enhanced_daily_recommendations` hasn't refreshed yet.

---

## 📞 Next Steps After Running Tests

### If All Tests Pass ✅
1. Copy the full test output
2. Share with me for final verification
3. System is production-ready!

### If Any Tests Fail ❌
1. Copy the full test output (including errors)
2. Share with me for debugging
3. I'll provide specific fixes

---

## 🎯 Manual Tests to Perform After Automated Tests

Once automated tests pass, verify these workflows manually:

### 1. Price Guard Test
- [ ] Edit a price to be outside tier bands (e.g., change $19.99 to $99.99)
- [ ] Click **Submit Ready/Sent**
- [ ] As manager: Should see override prompt
- [ ] Enter reason and confirm
- [ ] Verify override logged to `eros_ops_stg.scheduler_overrides_ext`

### 2. Caption Picker Test
- [ ] Open sidebar: **Open Sidebar**
- [ ] Enter creator: `alex_love`
- [ ] Select hour: `12`
- [ ] Click **Fetch Captions**
- [ ] Verify captions load without partition error
- [ ] Click **Apply to selected row** on any caption
- [ ] Verify caption appears in selected row

### 3. Randomize Minutes Test
- [ ] Select multiple rows in Time column
- [ ] Click **Randomize Minutes (±15)**
- [ ] Verify times change by ±15 minutes
- [ ] Check time overflow/underflow handled (23:55 → 00:10, etc.)

### 4. Submission Test
- [ ] Mark 2-3 rows as "READY" or "SENT" in Status column
- [ ] Click **Submit Ready/Sent**
- [ ] Verify success message
- [ ] Check `eros_ops.send_log` for records:
```sql
SELECT * FROM `of-scheduler-proj.eros_ops.send_log`
WHERE action_date = CURRENT_DATE()
  AND source = 'sheets_hub_v2'
ORDER BY action_ts DESC
LIMIT 10;
```

---

## ✅ Success Criteria

**All automated tests pass:** ✅ / ❌
**Caption picker works:** ✅ / ❌
**Price guard enforced:** ✅ / ❌
**Submissions logged:** ✅ / ❌

---

*Ready to run! Copy test output and share with me for final verification.*
