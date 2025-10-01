"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SheetRegistry = void 0;
const config_1 = require("../config");
const { sheets } = config_1.CONFIG;
exports.SheetRegistry = {
    ensureAll() {
        const ss = SpreadsheetApp.getActive();
        Object.values(sheets).forEach((name) => {
            if (!ss.getSheetByName(name)) {
                ss.insertSheet(name);
            }
        });
        this.seedControlHub();
        this.seedTodayPlanner();
        this.seedWeekPlanner();
        this.seedAlerts();
        this.seedCaptionStudio();
        this.seedPerformance();
        this.seedLogs();
        this.seedDiagnostics();
        this.seedSettings();
    },
    clearSheet(name) {
        const sheet = SpreadsheetApp.getActive().getSheetByName(name);
        if (!sheet)
            return;
        const range = sheet.getDataRange();
        if (range) {
            const rows = Math.max(range.getNumRows() - 1, 0);
            const cols = range.getNumColumns();
            if (rows > 0 && cols > 0) {
                sheet.getRange(2, 1, rows, cols).clearContent();
            }
        }
    },
    seedControlHub() {
        const sheet = SpreadsheetApp.getActive().getSheetByName(sheets.controlHub);
        if (!sheet)
            return;
        if (sheet.getLastRow() === 0) {
            sheet.appendRow(['Tile', 'Value', 'Detail']);
            sheet.setFrozenRows(1);
        }
    },
    seedTodayPlanner() {
        const sheet = SpreadsheetApp.getActive().getSheetByName(sheets.todayPlanner);
        if (!sheet || sheet.getLastRow() !== 0)
            return;
        sheet.appendRow([
            'Local Time', 'Creator', 'Page Handle', 'Page Type', 'Tier', 'Message Type', 'Subtype',
            'Rank', 'Score', 'Confidence', 'Price Tier', 'Suggested $', 'Fatigue', 'Opportunity',
            'Reason', 'Energy', 'Caption Guidance', 'Spacing OK', 'Mandatory', 'Status',
            'Price Override$', 'Caption ID', 'Caption Text', 'Scheduler Notes', 'Tracking Hash', 'ISO Timestamp'
        ]);
        sheet.setFrozenRows(1);
        sheet.setColumnWidths(1, 5, 110);
    },
    seedWeekPlanner() {
        const sheet = SpreadsheetApp.getActive().getSheetByName(sheets.weekPlanner);
        if (!sheet || sheet.getLastRow() !== 0)
            return;
        sheet.appendRow([
            'Date', 'Creator', 'Tier', 'Total Slots', 'Mandatory', 'Optional', 'Est Revenue', 'Fatigue Risk', 'Priority Band'
        ]);
        sheet.setFrozenRows(1);
    },
    seedAlerts() {
        const sheet = SpreadsheetApp.getActive().getSheetByName(sheets.alerts);
        if (!sheet || sheet.getLastRow() !== 0)
            return;
        sheet.appendRow(['Creator', 'Risk Level', 'Msg Count (30d)', 'Exact Time Repeats', 'Avg Spacing (min)', 'Notes']);
        sheet.setFrozenRows(1);
    },
    seedCaptionStudio() {
        const sheet = SpreadsheetApp.getActive().getSheetByName(sheets.captions);
        if (!sheet || sheet.getLastRow() !== 0)
            return;
        sheet.appendRow(['Creator', 'Hour', 'Caption ID', 'Caption Text', 'Confidence', 'Source']);
        sheet.setFrozenRows(1);
    },
    seedPerformance() {
        const sheet = SpreadsheetApp.getActive().getSheetByName(sheets.performance);
        if (!sheet || sheet.getLastRow() !== 0)
            return;
        sheet.appendRow(['Metric', 'Value', 'Detail']);
        sheet.setFrozenRows(1);
    },
    seedLogs() {
        const sheet = SpreadsheetApp.getActive().getSheetByName(sheets.logs);
        if (!sheet || sheet.getLastRow() !== 0)
            return;
        sheet.appendRow(['Timestamp', 'Creator', 'Status', 'Price', 'Caption ID', 'HOD', 'Scheduler', 'Tracking Hash', 'Action']);
        sheet.setFrozenRows(1);
    },
    seedDiagnostics() {
        const sheet = SpreadsheetApp.getActive().getSheetByName(sheets.diagnostics);
        if (!sheet || sheet.getLastRow() !== 0)
            return;
        sheet.appendRow(['Timestamp', 'Severity', 'Message', 'Context']);
        sheet.setFrozenRows(1);
    },
    seedSettings() {
        const sheet = SpreadsheetApp.getActive().getSheetByName(sheets.settings);
        if (!sheet || sheet.getLastRow() !== 0)
            return;
        sheet.appendRow(['Key', 'Value']);
        sheet.appendRow(['AUTO_REFRESH_MINUTES', '15']);
        sheet.appendRow(['ENABLE_CACHE', 'TRUE']);
        sheet.setFrozenRows(1);
    }
};
