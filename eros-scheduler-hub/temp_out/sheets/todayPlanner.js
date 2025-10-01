"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TodayPlanner = void 0;
const config_1 = require("../config");
const dataService_1 = require("../services/dataService");
const preflightService_1 = require("../services/preflightService");
const base_1 = require("./base");
const { sheets, timezone } = config_1.CONFIG;
const STATUS_OPTIONS = ['Planned', 'Ready', 'Queued', 'Sent', 'Hold'];
exports.TodayPlanner = {
    render() {
        base_1.SheetRegistry.ensureAll();
        const identity = dataService_1.DataService.getIdentity();
        const today = dataService_1.DataService.getTodayPlan(identity.schedulerEmail);
        const sheet = SpreadsheetApp.getActive().getSheetByName(sheets.todayPlanner);
        if (!sheet)
            return;
        base_1.SheetRegistry.clearSheet(sheets.todayPlanner);
        if (!today.length) {
            return;
        }
        const rows = today.map((row) => this.toSheetRow(row));
        sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
        const validation = SpreadsheetApp.newDataValidation()
            .requireValueInList(STATUS_OPTIONS, true)
            .setAllowInvalid(false)
            .build();
        sheet.getRange(2, 20, Math.max(rows.length, 1), 1).setDataValidation(validation);
        const preflight = new preflightService_1.PreflightService();
        const issues = preflight.evaluate(today);
        const diagSheet = SpreadsheetApp.getActive().getSheetByName(sheets.diagnostics);
        if (diagSheet) {
            base_1.SheetRegistry.clearSheet(sheets.diagnostics);
            const stamped = issues.map((issue) => [
                new Date(),
                issue.severity,
                issue.message,
                issue.context ? JSON.stringify(issue.context) : ''
            ]);
            if (stamped.length) {
                diagSheet.getRange(2, 1, stamped.length, stamped[0].length).setValues(stamped);
            }
        }
    },
    toSheetRow(row) {
        const hash = preflightService_1.PreflightService.trackingHash(row);
        return [
            row.local_time,
            row.username_std,
            row.page_handle,
            row.page_type,
            row.full_tier_assignment,
            row.message_type,
            row.message_subtype,
            Number(row.recommendation_rank || 0),
            Number(row.recommendation_score || 0),
            row.timing_confidence,
            row.price_tier,
            Number(row.suggested_price || 0),
            Number(row.fatigue_safety_score || 0),
            row.opportunity_quality,
            row.recommendation_reason,
            row.time_energy_required,
            row.caption_guidance,
            row.spacing_ok ? '✅' : '⚠️',
            row.is_mandatory ? 'Yes' : 'No',
            'Planned',
            '',
            '',
            '',
            '',
            hash,
            row.recommended_send_ts
        ];
    }
};
