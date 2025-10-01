import {CONFIG} from '../config';
import {DataService, TodayRow} from '../services/dataService';
import {PreflightService} from '../services/preflightService';
import {SheetRegistry} from './base';

const {sheets, timezone} = CONFIG;

const STATUS_OPTIONS = ['Planned', 'Ready', 'Queued', 'Sent', 'Hold'];

export const TodayPlanner = {
  render(): void {
    SheetRegistry.ensureAll();
    const identity = DataService.getIdentity();
    const today = DataService.getTodayPlan(identity.schedulerEmail);
    const sheet = SpreadsheetApp.getActive().getSheetByName(sheets.todayPlanner);
    if (!sheet) return;
    SheetRegistry.clearSheet(sheets.todayPlanner);

    if (!today.length) {
      return;
    }

    const rows = today.map((row) => this.toSheetRow(row));
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);

    const validation = SpreadsheetApp.newDataValidation()
      .requireValueInList(STATUS_OPTIONS, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(2, 20, Math.max(rows.length, 1), 1).setDataValidation(validation);

    const preflight = new PreflightService();
    const issues = preflight.evaluate(today);
    const diagSheet = SpreadsheetApp.getActive().getSheetByName(sheets.diagnostics);
    if (diagSheet) {
      SheetRegistry.clearSheet(sheets.diagnostics);
      const stamped = issues.map((issue) => [
        new Date(),
        issue.severity,
        issue.message,
        issue.context ? JSON.stringify(issue.context) : ''
      ]);
      if (stamped.length) {
        diagSheet.getRange(2, 1, stamped.length, stamped[0].length).setValues(stamped);
      }
    }
  },

  toSheetRow(row: TodayRow): (string | number | boolean)[] {
    const hash = PreflightService.trackingHash(row);
    return [
      row.local_time,
      row.username_std,
      row.page_handle,
      row.page_type,
      row.full_tier_assignment,
      row.message_type,
      row.message_subtype,
      Number(row.recommendation_rank || 0),
      Number(row.recommendation_score || 0),
      row.timing_confidence,
      row.price_tier,
      Number(row.suggested_price || 0),
      Number(row.fatigue_safety_score || 0),
      row.opportunity_quality,
      row.recommendation_reason,
      row.time_energy_required,
      row.caption_guidance,
      row.spacing_ok ? '✅' : '⚠️',
      row.is_mandatory ? 'Yes' : 'No',
      'Planned',
      '',
      '',
      '',
      '',
      hash,
      row.recommended_send_ts
    ];
  }
};
