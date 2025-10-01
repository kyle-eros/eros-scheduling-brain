# 🌏 EROS Scheduler Team Timezone Reference Guide

## Team Overview
- **Team Location**: Philippines 🇵🇭
- **Your Location**: Mountain Time (MST/MDT) 🇺🇸
- **Time Difference**: Philippines is **15 hours ahead** of MST

---

## 📅 Quick Time Conversion Table

### Key Schedule Times
| Event | MST Time | Philippines Time (PHT) | Day |
|-------|----------|----------------------|------|
| **Pipeline Runs** | 12:30 AM | 3:30 PM | Same day |
| **Data Ready** | 12:45 AM | 3:45 PM | Same day |
| **Early Birds Start** | 1:00 AM | 4:00 PM | Same day |
| **Main Team Starts** | 3:00 AM | 6:00 PM | Same day |
| **Optional Refresh** | 6:00 AM | 9:00 PM | Same day |
| **Team Peak Hours** | 3-8 AM | 6-11 PM | Same day |
| **Team Shift Ends** | 11:00 AM | 2:00 AM | Next day |

---

## 🕐 Full Working Hours Breakdown

### Philippines Team Schedule (Their Local Time)
```
Philippines (PHT - UTC+8)
├── 3:30 PM - Pipeline runs, data processing
├── 4:00 PM - Early schedulers can start working
├── 6:00 PM - Main team starts (your 3 AM MST)
├── 9:00 PM - Optional data refresh (your 6 AM MST)
├── 11:00 PM - Peak activity continues
└── 2:00 AM - Latest workers sign off (your 11 AM MST)
```

### Your Management Schedule (MST)
```
Mountain Time (MST - UTC-7)
├── 12:30 AM - Pipeline executes
├── 1:00 AM - Monitor early birds starting
├── 3:00 AM - Main team online (if you're awake!)
├── 6:00 AM - Good time to check in
├── 8:00 AM - Team has been working 5+ hours
└── 11:00 AM - Team winding down
```

---

## 💬 Discord Communication Windows

### Best Times to Reach Team
| Your Time (MST) | Their Time (PHT) | Status |
|-----------------|------------------|--------|
| 3:00 - 10:00 AM | 6:00 PM - 1:00 AM | ✅ **Most Active** |
| 1:00 - 3:00 AM | 4:00 - 6:00 PM | ⚠️ Early birds only |
| 10:00 - 11:00 AM | 1:00 - 2:00 AM | ⚠️ Winding down |
| 11:00 AM - 1:00 AM | 2:00 AM - 4:00 PM | ❌ Team offline |

### Emergency Contact Windows
- **Critical Issues**: 3:00 - 8:00 AM MST (main team active)
- **Non-urgent**: Post in Discord, team will see when they start
- **Your evening update**: Post at 8-10 PM MST → They see it when starting

---

## 📊 Data Pipeline Schedule

### Primary Pipeline: 12:30 AM MST Daily
```
Timeline (MST):
11:30 PM (prev day) ── Data collection window closes
12:00 AM ──────────── Pipeline triggered
12:30 AM ──────────── Processing completes
12:45 AM ──────────── Data available in BigQuery
1:00 AM ───────────── Early schedulers begin work
3:00 AM ───────────── Main team starts
```

### Optional Refresh: 6:00 AM MST
```
Purpose: Catch late-arriving data, mid-shift accuracy boost
5:45 AM ───────────── Refresh triggered
6:00 AM ───────────── Updated data available
6:15 AM ───────────── Team notified of updates
```

---

## 🚨 Maintenance Windows

### Best Times for System Maintenance
| MST Time | PHT Time | Impact |
|----------|----------|---------|
| 12:00 PM - 11:00 PM | 3:00 AM - 2:00 PM | ✅ **Best** - Team offline |
| 11:00 AM - 12:00 PM | 2:00 - 3:00 AM | ⚠️ OK - Team ending shift |
| 11:00 PM - 12:30 AM | 2:00 - 3:30 PM | ⚠️ Avoid - Pipeline running |
| 1:00 - 11:00 AM | 4:00 PM - 2:00 AM | ❌ **Never** - Team working |

---

## 📱 Setting Up Your Schedule

### Recommended Calendar Events (MST)
1. **12:30 AM** - "Pipeline Run - Check if needed"
2. **6:00 AM** - "Check team Discord, pipeline status"
3. **10:00 AM** - "End of day check-in with team"

### Philippines Team Calendar (PHT)
1. **3:30 PM** - "Data pipeline completes"
2. **4:00 PM** - "Can start scheduling work"
3. **6:00 PM** - "Full team online"
4. **9:00 PM** - "Check for data refresh"

---

## 🌍 Daylight Saving Time Note

**Important**:
- Philippines does **NOT** observe daylight saving
- Mountain Time shifts between MST (UTC-7) and MDT (UTC-6)
- During MDT (March-November), Philippines is only **14 hours ahead**

### DST Adjustment Table
| Season | Your Time | Time Diff | Pipeline Schedule |
|--------|-----------|-----------|-------------------|
| Winter (MST) | UTC-7 | +15 hours | 12:30 AM MST |
| Summer (MDT) | UTC-6 | +14 hours | 12:30 AM MDT (1:30 AM effective) |

---

## 📞 Quick Reference Card

### Save This for Quick Access:
```
🇵🇭 Philippines = MST + 15 hours (winter) / + 14 hours (summer)

Key Times (MST):
• Pipeline: 12:30 AM
• Team Start: 1:00 - 3:00 AM
• Peak Hours: 3:00 - 8:00 AM
• Team End: 11:00 AM

Discord Check-ins (MST):
• Morning: 6:00 - 8:00 AM
• Evening: 8:00 - 10:00 PM (for next day)
```

---

## 💡 Pro Tips

1. **Schedule Discord messages** for 2:00 AM MST to be seen when team starts
2. **Pipeline alerts** should go to your phone for 12:30 AM issues
3. **Friday updates** are crucial - post Thursday evening MST
4. **Holiday coordination** - Check both US and Philippines holidays
5. **Use Discord timezone bot** to display times in both zones

---

*Last updated: October 1, 2025*
*Team Location: Philippines (UTC+8)*
*Management Location: Mountain Time (UTC-7/6)*