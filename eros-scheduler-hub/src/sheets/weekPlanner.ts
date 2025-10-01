import {CONFIG} from '../config';
import {DataService} from '../services/dataService';
import {SheetRegistry} from './base';

const {sheets} = CONFIG;

export const WeekPlanner = {
  render(): void {
    SheetRegistry.ensureAll();
    const identity = DataService.getIdentity();
    const week = DataService.getWeekPlan(identity.schedulerEmail);
    const sheet = SpreadsheetApp.getActive().getSheetByName(sheets.weekPlanner);
    if (!sheet) return;
    SheetRegistry.clearSheet(sheets.weekPlanner);
    if (!week.length) return;
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
