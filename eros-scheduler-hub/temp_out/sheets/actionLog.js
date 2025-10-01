"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionLog = void 0;
const config_1 = require("../config");
const dataService_1 = require("../services/dataService");
const base_1 = require("./base");
const { sheets } = config_1.CONFIG;
exports.ActionLog = {
    render() {
        base_1.SheetRegistry.ensureAll();
        const identity = dataService_1.DataService.getIdentity();
        const rows = dataService_1.DataService.getRecentActions(identity.schedulerEmail);
        const sheet = SpreadsheetApp.getActive().getSheetByName(sheets.logs);
        if (!sheet)
            return;
        base_1.SheetRegistry.clearSheet(sheets.logs);
        if (!rows.length)
            return;
        sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }
};
