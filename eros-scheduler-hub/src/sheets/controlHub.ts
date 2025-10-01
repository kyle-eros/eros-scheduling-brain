import {CONFIG} from '../config';
import {DataService, HomeTile} from '../services/dataService';
import {SheetRegistry} from './base';

const {sheets} = CONFIG;

export const ControlHub = {
  render(): void {
    SheetRegistry.ensureAll();
    const identity = DataService.getIdentity();
    const tiles = DataService.getHomeTiles(identity.schedulerEmail);
    const sheet = SpreadsheetApp.getActive().getSheetByName(sheets.controlHub);
    if (!sheet) return;
    SheetRegistry.clearSheet(sheets.controlHub);
    if (!tiles.length) return;
    const rows = tiles.map((tile: HomeTile) => [tile.label, tile.value, tile.detail]);
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
  }
};
