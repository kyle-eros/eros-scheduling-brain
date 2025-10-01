"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformancePulse = void 0;
const config_1 = require("../config");
const dataService_1 = require("../services/dataService");
const base_1 = require("./base");
const { sheets } = config_1.CONFIG;
exports.PerformancePulse = {
    render() {
        base_1.SheetRegistry.ensureAll();
        const identity = dataService_1.DataService.getIdentity();
        const metrics = dataService_1.DataService.getPerformanceMetrics(identity.schedulerEmail);
        const sheet = SpreadsheetApp.getActive().getSheetByName(sheets.performance);
        if (!sheet)
            return;
        base_1.SheetRegistry.clearSheet(sheets.performance);
        if (!metrics.length)
            return;
        const rows = metrics.map((metric) => [metric.metric, metric.value, metric.detail]);
        sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }
};
