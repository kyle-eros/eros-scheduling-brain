import {SheetRegistry} from './sheets/base';
import {ControlHub} from './sheets/controlHub';
import {TodayPlanner} from './sheets/todayPlanner';
import {WeekPlanner} from './sheets/weekPlanner';
import {RiskConsole} from './sheets/riskConsole';
import {PerformancePulse} from './sheets/performance';
import {ActionLog} from './sheets/actionLog';
import {CONFIG} from './config';
import {DataService, TodayRow} from './services/dataService';
import {PreflightService, PreflightIssue, PriceViolation} from './services/preflightService';
import {LoggingService, ActionPayload} from './services/loggingService';
import {OverrideService} from './services/overrideService';

const loggingService = new LoggingService();
const preflightService = new PreflightService();
const overrideService = new OverrideService();

const COL = {
  LOCAL_TIME: 1,
  CREATOR: 2,
  PAGE_HANDLE: 3,
  PAGE_TYPE: 4,
  TIER: 5,
  MESSAGE_TYPE: 6,
  SUBTYPE: 7,
  RANK: 8,
  SCORE: 9,
  CONFIDENCE: 10,
  PRICE_TIER: 11,
  SUGGESTED_PRICE: 12,
  FATIGUE: 13,
  OPPORTUNITY: 14,
  REASON: 15,
  ENERGY: 16,
  GUIDANCE: 17,
  SPACING: 18,
  MANDATORY: 19,
  STATUS: 20,
  PRICE_OVERRIDE: 21,
  CAPTION_ID: 22,
  CAPTION_TEXT: 23,
  NOTES: 24,
  TRACKING_HASH: 25,
  ISO_TIMESTAMP: 26
} as const;

const STATUS_READY = ['READY', 'SENT'];

function onOpen(): void {
  initializeMenu();
}

function initializeMenu(): void {
  SheetRegistry.ensureAll();
  ControlHub.render();
  SpreadsheetApp.getUi()
    .createMenu('🚀 EROS Scheduler Hub')
    .addItem('Open Sidebar', 'openSidebar')
    .addSeparator()
    .addItem('Load Today', 'renderToday')
    .addItem('Load Week', 'renderWeek')
    .addItem('Randomize Minutes (±15)', 'randomizeMinutes')
    .addItem('Run Preflight', 'runPreflight')
    .addItem('Submit Ready/Sent', 'submitReady')
    .addSeparator()
    .addItem('Refresh Logs', 'renderLogs')
    .addItem('Refresh Performance', 'renderPerformance')
    .addSeparator()
    .addItem('🧪 Run Automated Tests', 'runAutomatedTests')
    .addItem('Install 15m Refresh Trigger', 'installTriggers')
    .addToUi();
}

function openSidebar(): void {
  const html = HtmlService.createHtmlOutputFromFile('ui/sidebar.html').setTitle('EROS Scheduler Hub');
  SpreadsheetApp.getUi().showSidebar(html);
}

function renderToday(): string {
  TodayPlanner.render();
  ControlHub.render();
  RiskConsole.render();
  PerformancePulse.render();
  return 'Today planner refreshed.';
}

function renderWeek(): string {
  WeekPlanner.render();
  return 'Week view refreshed.';
}

function renderLogs(): string {
  ActionLog.render();
  return 'Recent action log refreshed.';
}

function renderPerformance(): string {
  PerformancePulse.render();
  return 'Performance metrics refreshed.';
}

function runPreflight(): string {
  const rows = collectTodayRows();
  if (!rows.length) {
    throw new Error('No planner rows available. Load Today first.');
  }
  const issues = preflightService.evaluate(rows);
  writeDiagnostics(issues);
  if (!issues.length) {
    return 'Preflight ✅ No issues.';
  }
  return `Preflight found ${issues.length} item(s). Check Diagnostics sheet.`;
}

function submitReady(): string {
  const identity = DataService.getIdentity();
  const sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.sheets.todayPlanner);
  if (!sheet) throw new Error('Today Planner sheet missing.');
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) throw new Error('No planner rows.');

  // Price guard: check for violations
  const rows = collectTodayRows();
  const violations = overrideService.validatePrices(rows);

  if (violations.length > 0) {
    // Check if user is a manager
    const isManager = overrideService.isManager();

    if (!isManager) {
      // Non-manager cannot override
      const violationSummary = violations.slice(0, 5)
        .map(v => `${v.creator}: $${v.price} outside [${v.min}-${v.max}]`)
        .join('\n');
      SpreadsheetApp.getUi().alert(
        'Price Validation Failed',
        `${violations.length} row(s) have prices outside tier bands:\n\n${violationSummary}\n\nPlease adjust prices or contact a manager for override approval.`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      return 'Submission blocked due to price violations.';
    }

    // Manager override workflow
    const violationSummary = violations.slice(0, 5)
      .map(v => `${v.creator}: $${v.price} outside [${v.min}-${v.max}]`)
      .join('\n');

    const response = SpreadsheetApp.getUi().prompt(
      'Manager Override Required',
      `${violations.length} price violation(s) detected:\n\n${violationSummary}\n\n` +
      'Enter reason for override (or Cancel to abort):',
      SpreadsheetApp.getUi().ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() !== SpreadsheetApp.getUi().Button.OK || !response.getResponseText().trim()) {
      return 'Submission cancelled. No override logged.';
    }

    // Log the override
    overrideService.logOverrides(violations, response.getResponseText().trim(), identity.schedulerEmail);
  }

  // Proceed with submission
  const width = COL.ISO_TIMESTAMP;
  const values = sheet.getRange(2, 1, lastRow - 1, width).getValues();
  const payloads: ActionPayload[] = [];

  values.forEach((row) => {
    const status = String(row[COL.STATUS - 1] || '').toUpperCase();
    if (!STATUS_READY.includes(status)) return;
    const usernameStd = String(row[COL.CREATOR - 1] || '').trim();
    if (!usernameStd) return;
    const priceOverride = parseFloat(String(row[COL.PRICE_OVERRIDE - 1] || ''));
    const suggestedPrice = parseFloat(String(row[COL.SUGGESTED_PRICE - 1] || '0'));
    const price = Number.isFinite(priceOverride) ? priceOverride : suggestedPrice;
    const hash = String(row[COL.TRACKING_HASH - 1] || '').trim();
    const pageType = String(row[COL.PAGE_TYPE - 1] || '').trim().toLowerCase();
    const hod = parseHour(String(row[COL.LOCAL_TIME - 1] || ''));
    payloads.push({
      trackingHash: hash,
      usernameStd,
      pageType,
      usernamePage: `${usernameStd}__${pageType || 'main'}`,
      priceUsd: Number.isFinite(price) ? price : 0,
      captionId: String(row[COL.CAPTION_ID - 1] || '') || null,
      hodLocal: hod,
      status: status === 'SENT' ? 'Sent' : 'Ready'
    });
  });

  if (!payloads.length) {
    throw new Error('Mark at least one row as Ready or Sent before submitting.');
  }

  loggingService.submitActions(payloads, identity.schedulerEmail, identity.schedulerCode);
  ActionLog.render();

  const overrideNote = violations.length > 0 ? ` (${violations.length} override(s) logged)` : '';
  return `Logged ${payloads.length} action(s) to eros_ops.send_log${overrideNote}.`;
}

function getCaptions(args: {creator: string; hod: number}): any[] {
  const {creator, hod} = args;
  const today = Utilities.formatDate(new Date(), CONFIG.timezone, 'yyyy-MM-dd');
  const rows = DataService.getCaptionSuggestions(creator, hod, today);
  return rows as any[];
}

function applyCaption(args: {id: string; text: string}): string {
  const sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.sheets.todayPlanner);
  if (!sheet) throw new Error('Today Planner sheet missing.');
  const active = sheet.getActiveRange();
  if (!active) throw new Error('Select a planner row first.');
  const row = active.getRow();
  if (row <= 1) throw new Error('Select a planner row below the header.');
  sheet.getRange(row, COL.CAPTION_ID).setValue(args.id || '');
  sheet.getRange(row, COL.CAPTION_TEXT).setValue(args.text || '');
  return 'Caption applied to selected row.';
}

function installTriggers(): string {
  ScriptApp.getProjectTriggers().forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('renderToday').timeBased().everyMinutes(15).create();
  return 'Installed 15-minute refresh trigger.';
}

function runAutomatedTests(): string {
  const results: string[] = [];
  const startTime = new Date().getTime();

  try {
    // Test 1: Basic Sheet Structure
    results.push('TEST 1: Verify sheet structure');
    const ss = SpreadsheetApp.getActive();
    const requiredSheets = ['Control Hub', 'Today Planner', 'Week View', 'Risk Console', 'Performance Pulse', 'Action Log', 'Diagnostics'];
    const existingSheets = ss.getSheets().map(s => s.getName());
    requiredSheets.forEach(name => {
      if (existingSheets.includes(name)) {
        results.push(`  ✅ Sheet "${name}" exists`);
      } else {
        results.push(`  ❌ Sheet "${name}" MISSING`);
      }
    });

    // Test 2: Menu Functions
    results.push('\nTEST 2: Execute core functions');

    try {
      const todayResult = renderToday();
      results.push(`  ✅ renderToday() - ${todayResult}`);
    } catch (e: any) {
      results.push(`  ❌ renderToday() FAILED: ${e.message}`);
    }

    try {
      const weekResult = renderWeek();
      results.push(`  ✅ renderWeek() - ${weekResult}`);
    } catch (e: any) {
      results.push(`  ❌ renderWeek() FAILED: ${e.message}`);
    }

    try {
      const perfResult = renderPerformance();
      results.push(`  ✅ renderPerformance() - ${perfResult}`);
    } catch (e: any) {
      results.push(`  ❌ renderPerformance() FAILED: ${e.message}`);
    }

    try {
      const logsResult = renderLogs();
      results.push(`  ✅ renderLogs() - ${logsResult}`);
    } catch (e: any) {
      results.push(`  ❌ renderLogs() FAILED: ${e.message}`);
    }

    // Test 3: Data Validation
    results.push('\nTEST 3: Validate data loaded');
    const todaySheet = ss.getSheetByName(CONFIG.sheets.todayPlanner);
    if (todaySheet) {
      const rowCount = todaySheet.getLastRow();
      if (rowCount > 1) {
        results.push(`  ✅ Today Planner has ${rowCount - 1} data rows`);

        // Check first data row has required columns
        const firstRow = todaySheet.getRange(2, 1, 1, 10).getValues()[0];
        if (firstRow[0]) results.push(`  ✅ Time column populated`);
        if (firstRow[1]) results.push(`  ✅ Creator column populated`);
        if (firstRow[11]) results.push(`  ✅ Price column populated`);
      } else {
        results.push(`  ⚠️ Today Planner has no data rows (check if today has recommendations)`);
      }
    }

    // Test 4: Preflight Function
    results.push('\nTEST 4: Run preflight checks');
    try {
      const preflightResult = runPreflight();
      results.push(`  ✅ runPreflight() - ${preflightResult}`);

      const diagSheet = ss.getSheetByName(CONFIG.sheets.diagnostics);
      if (diagSheet && diagSheet.getLastRow() > 1) {
        results.push(`  ✅ Diagnostics sheet populated with ${diagSheet.getLastRow() - 1} issues`);
      } else {
        results.push(`  ✅ Diagnostics sheet created (no issues found)`);
      }
    } catch (e: any) {
      results.push(`  ❌ runPreflight() FAILED: ${e.message}`);
    }

    // Test 5: Caption Suggestions
    results.push('\nTEST 5: Caption suggestion system');
    try {
      const testCreator = 'alex_love';
      const captions = getCaptions({creator: testCreator, hod: 12});
      if (captions && captions.length > 0) {
        results.push(`  ✅ getCaptions() returned ${captions.length} results for ${testCreator}`);
        results.push(`  ✅ Caption source: ${captions[0].source}, confidence: ${captions[0].confidence}`);
      } else {
        results.push(`  ⚠️ getCaptions() returned 0 results (may be expected if no matches)`);
      }
    } catch (e: any) {
      results.push(`  ❌ getCaptions() FAILED: ${e.message}`);
    }

    // Test 6: Identity & RBAC
    results.push('\nTEST 6: User identity and permissions');
    try {
      const identity = DataService.getIdentity();
      results.push(`  ✅ Identity resolved: ${identity.schedulerDisplayName} (${identity.schedulerEmail})`);
      results.push(`  ✅ Scheduler code: ${identity.schedulerCode}`);
      results.push(`  ✅ Manager status: ${identity.isManager}`);
    } catch (e: any) {
      results.push(`  ❌ Identity resolution FAILED: ${e.message}`);
    }

    // Test 7: Override Service
    results.push('\nTEST 7: Override service checks');
    try {
      const isManager = overrideService.isManager();
      results.push(`  ✅ Manager check: ${isManager}`);
    } catch (e: any) {
      results.push(`  ❌ Manager check FAILED: ${e.message}`);
    }

    const endTime = new Date().getTime();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    results.push(`\n⏱️ Total test duration: ${duration}s`);
    results.push(`\n✅ Automated UI tests complete!`);

    return results.join('\n');

  } catch (e: any) {
    return `FATAL ERROR: ${e.message}\n\n${results.join('\n')}`;
  }
}

function randomizeMinutes(): string {
  const sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.sheets.todayPlanner);
  if (!sheet) throw new Error('Today Planner sheet missing.');

  const selection = sheet.getActiveRange();
  if (!selection) throw new Error('Select rows in the Time column first.');

  let count = 0;
  for (let r = 1; r <= selection.getNumRows(); r++) {
    const row = selection.getRow() + r - 1;
    if (row <= 1) continue; // Skip header

    const cell = sheet.getRange(row, COL.LOCAL_TIME);
    const timeStr = String(cell.getValue() || '').trim();
    const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr);
    if (!match) continue;

    let hours = parseInt(match[1], 10);
    let minutes = parseInt(match[2], 10);

    // Add random offset: -15 to +15 minutes
    const offset = Math.floor(Math.random() * 31) - 15;
    minutes += offset;

    // Handle overflow/underflow
    while (minutes < 0) {
      minutes += 60;
      hours = (hours + 23) % 24;
    }
    while (minutes >= 60) {
      minutes -= 60;
      hours = (hours + 1) % 24;
    }

    const newTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    cell.setValue(newTime);
    count++;
  }

  return `Randomized ${count} time slot(s) (±15 minutes).`;
}


function collectTodayRows(): TodayRow[] {
  const sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.sheets.todayPlanner);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, COL.ISO_TIMESTAMP).getValues();
  return values
    .filter((row) => row[COL.CREATOR - 1])
    .map((row) => toTodayRow(row));
}

function toTodayRow(row: any[]): TodayRow {
  const iso = String(row[COL.ISO_TIMESTAMP - 1] || '');
  const localTime = String(row[COL.LOCAL_TIME - 1] || '00:00');
  const recommendedTs = iso ? new Date(iso).toISOString() : buildIsoFromLocal(localTime);
  const override = parseFloat(String(row[COL.PRICE_OVERRIDE - 1] || ''));
  const suggested = parseFloat(String(row[COL.SUGGESTED_PRICE - 1] || '0'));
  return {
    recommended_send_ts: recommendedTs,
    local_time: localTime,
    username_std: String(row[COL.CREATOR - 1] || ''),
    page_handle: String(row[COL.PAGE_HANDLE - 1] || ''),
    page_type: String(row[COL.PAGE_TYPE - 1] || ''),
    full_tier_assignment: String(row[COL.TIER - 1] || ''),
    message_type: String(row[COL.MESSAGE_TYPE - 1] || ''),
    message_subtype: String(row[COL.SUBTYPE - 1] || ''),
    recommendation_rank: Number(row[COL.RANK - 1] || 0),
    recommendation_score: Number(row[COL.SCORE - 1] || 0),
    timing_confidence: String(row[COL.CONFIDENCE - 1] || ''),
    price_tier: String(row[COL.PRICE_TIER - 1] || ''),
    suggested_price: Number.isFinite(override) ? override : suggested,
    fatigue_safety_score: Number(row[COL.FATIGUE - 1] || 0),
    opportunity_quality: String(row[COL.OPPORTUNITY - 1] || ''),
    recommendation_reason: String(row[COL.REASON - 1] || ''),
    time_energy_required: String(row[COL.ENERGY - 1] || ''),
    caption_guidance: String(row[COL.GUIDANCE - 1] || ''),
    spacing_ok: String(row[COL.SPACING - 1] || '').startsWith('✅'),
    is_mandatory: String(row[COL.MANDATORY - 1] || '').toLowerCase() === 'yes'
  };
}

function writeDiagnostics(issues: PreflightIssue[]): void {
  const sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.sheets.diagnostics);
  if (!sheet) return;
  SheetRegistry.clearSheet(CONFIG.sheets.diagnostics);
  if (!issues.length) return;
  const rows = issues.map((issue) => [
    new Date(),
    issue.severity,
    issue.message,
    issue.context ? JSON.stringify(issue.context) : ''
  ]);
  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

function parseHour(hhmm: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!match) return 0;
  return Number(match[1]);
}

function buildIsoFromLocal(hhmm: string): string {
  const today = Utilities.formatDate(new Date(), CONFIG.timezone, 'yyyy-MM-dd');
  const dt = new Date(`${today}T${hhmm}:00`);
  return new Date(dt.getTime()).toISOString();
}

(globalThis as unknown as Record<string, unknown>).onOpen = onOpen;
(globalThis as unknown as Record<string, unknown>).openSidebar = openSidebar;
(globalThis as unknown as Record<string, unknown>).renderToday = renderToday;
(globalThis as unknown as Record<string, unknown>).renderWeek = renderWeek;
(globalThis as unknown as Record<string, unknown>).renderLogs = renderLogs;
(globalThis as unknown as Record<string, unknown>).renderPerformance = renderPerformance;
(globalThis as unknown as Record<string, unknown>).runPreflight = runPreflight;
(globalThis as unknown as Record<string, unknown>).submitReady = submitReady;
(globalThis as unknown as Record<string, unknown>).getCaptions = getCaptions;
(globalThis as unknown as Record<string, unknown>).applyCaption = applyCaption;
(globalThis as unknown as Record<string, unknown>).installTriggers = installTriggers;
(globalThis as unknown as Record<string, unknown>).randomizeMinutes = randomizeMinutes;
