import {CONFIG} from '../config';
import {DataService} from '../services/dataService';
import {SheetRegistry} from './base';

const {sheets} = CONFIG;

export const ActionLog = {
  render(): void {
    SheetRegistry.ensureAll();
    const identity = DataService.getIdentity();
    const rows = DataService.getRecentActions(identity.schedulerEmail);
    const sheet = SpreadsheetApp.getActive().getSheetByName(sheets.logs);
    if (!sheet) return;
    SheetRegistry.clearSheet(sheets.logs);
    if (!rows.length) return;
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
};
