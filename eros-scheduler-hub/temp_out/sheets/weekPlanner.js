"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeekPlanner = void 0;
const config_1 = require("../config");
const dataService_1 = require("../services/dataService");
const base_1 = require("./base");
const { sheets } = config_1.CONFIG;
exports.WeekPlanner = {
    render() {
        base_1.SheetRegistry.ensureAll();
        const identity = dataService_1.DataService.getIdentity();
        const week = dataService_1.DataService.getWeekPlan(identity.schedulerEmail);
        const sheet = SpreadsheetApp.getActive().getSheetByName(sheets.weekPlanner);
        if (!sheet)
            return;
        base_1.SheetRegistry.clearSheet(sheets.weekPlanner);
        if (!week.length)
            return;
        const rows = week.map((row) => [
            row.recommendation_date,
            row.username_std,
            row.full_tier_assignment,
            Number(row.total_slots || 0),
            Number(row.mandatory_slots || 0),
            Number(row.optional_slots || 0),
            Number(row.est_revenue || 0),
            row.fatigue_risk,
            row.priority_band
        ]);
        sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }
};
