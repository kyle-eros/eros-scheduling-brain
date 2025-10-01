"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ControlHub = void 0;
const config_1 = require("../config");
const dataService_1 = require("../services/dataService");
const base_1 = require("./base");
const { sheets } = config_1.CONFIG;
exports.ControlHub = {
    render() {
        base_1.SheetRegistry.ensureAll();
        const identity = dataService_1.DataService.getIdentity();
        const tiles = dataService_1.DataService.getHomeTiles(identity.schedulerEmail);
        const sheet = SpreadsheetApp.getActive().getSheetByName(sheets.controlHub);
        if (!sheet)
            return;
        base_1.SheetRegistry.clearSheet(sheets.controlHub);
        if (!tiles.length)
            return;
        const rows = tiles.map((tile) => [tile.label, tile.value, tile.detail]);
        sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
        sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
    }
};
