import {CONFIG} from '../config';
import {DataService} from '../services/dataService';
import {SheetRegistry} from './base';

const {sheets} = CONFIG;

export const PerformancePulse = {
  render(): void {
    SheetRegistry.ensureAll();
    const identity = DataService.getIdentity();
    const metrics = DataService.getPerformanceMetrics(identity.schedulerEmail);
    const sheet = SpreadsheetApp.getActive().getSheetByName(sheets.performance);
    if (!sheet) return;
    SheetRegistry.clearSheet(sheets.performance);
    if (!metrics.length) return;
    const rows = metrics.map((metric) => [metric.metric, metric.value, metric.detail]);
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
};
