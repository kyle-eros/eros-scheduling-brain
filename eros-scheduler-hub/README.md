# EROS Scheduler Hub (Sheets UI Layer)

Modern, type-safe Google Sheets interface for the EROS operating stack. This workspace is intentionally isolated from
legacy Apps Script files and is designed to be compiled with TypeScript prior to pushing via `clasp`.

## Highlights
- Modular services for BigQuery access, caching, planning logic, caption intelligence, and logging.
- Spreadsheet becomes a thin writable surface fed from precomputed scheduler caches.
- Sidebar-driven workflow with Today/Week views, caption picker, authenticity alerts, and submission guardrails.
- Writes limited to `eros_ops.send_log`; all reads route through Dataform curations in `eros_messaging_*` datasets.

## Development Flow
1. Install dependencies: `npm install`
2. Build: `npm run build`
3. Authenticate: `clasp login`
4. Create or link Apps Script project: `clasp create --title "EROS Scheduler Hub" --type sheets`
5. Push compiled code: `npm run push`

## Deployment Notes
- Adjust `appsscript.json` time zone if schedulers operate outside Mountain Time.
- Configure installable triggers using the `installTriggers` menu option after first authorization.
- For PROD, set Cloud project on the Apps Script file to `of-scheduler-proj` so BigQuery quota and billing land correctly.
