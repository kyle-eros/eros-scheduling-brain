"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskConsole = void 0;
const config_1 = require("../config");
const dataService_1 = require("../services/dataService");
const base_1 = require("./base");
const { sheets } = config_1.CONFIG;
exports.RiskConsole = {
    render() {
        base_1.SheetRegistry.ensureAll();
        const identity = dataService_1.DataService.getIdentity();
        const alerts = dataService_1.DataService.getAuthenticityAlerts(identity.schedulerEmail);
        const sheet = SpreadsheetApp.getActive().getSheetByName(sheets.alerts);
        if (!sheet)
            return;
        base_1.SheetRegistry.clearSheet(sheets.alerts);
        if (!alerts.length)
            return;
        const rows = alerts.map((row) => [
            row.username_std,
            row.pattern_risk_level.toUpperCase(),
            Number(row.msg_count_30d || 0),
            Number(row.exact_time_repetitions_30d || 0),
            Number(row.avg_spacing_minutes_30d || 0),
            row.pattern_risk_level === 'high' ? 'Escalate to manager' : 'Monitor'
        ]);
        sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }
};
