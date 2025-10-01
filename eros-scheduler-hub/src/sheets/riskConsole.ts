import {CONFIG} from '../config';
import {DataService} from '../services/dataService';
import {SheetRegistry} from './base';

const {sheets} = CONFIG;

export const RiskConsole = {
  render(): void {
    SheetRegistry.ensureAll();
    const identity = DataService.getIdentity();
    const alerts = DataService.getAuthenticityAlerts(identity.schedulerEmail);
    const sheet = SpreadsheetApp.getActive().getSheetByName(sheets.alerts);
    if (!sheet) return;
    SheetRegistry.clearSheet(sheets.alerts);
    if (!alerts.length) return;
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
