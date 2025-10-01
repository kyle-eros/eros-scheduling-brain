# Scheduler Hub UI Blueprint

## Goal
Deliver a resilient, scheduler-friendly Sheets experience that complements the existing EROS data stack. The workbook acts as a thin interaction layer over curated marts and features, while all writes are constrained to `eros_ops.send_log`.

## Workbook Layout
- **Control Hub** — KPI tiles, data freshness indicators, and quick links to actions.
- **Today Planner** — Editable grid for same-day execution. Columns align with legacy A:P contract with helper metadata (pricing, fatigue, opportunity, tracking hash, ISO timestamp).
- **Week Planner** — Seven-day roll-up per creator highlighting mandatory counts, optional capacity, and revenue opportunity.
- **Risk Console** — Authenticity + fatigue alerts sourced from `eros_messaging_feat.authenticity_monitor` and recommendation fatigue bands.
- **Caption Studio** — Output surface for caption pulls triggered from the sidebar.
- **Performance Pulse** — Rolling 7-day operational metrics sourced from `eros_ops.send_log` for rapid retros.
- **Action Log** — Direct mirror of the last 200 submissions for audit + reconciliation.
- **Diagnostics** — Structured error + preflight output for support.
- **Settings** — Key-value overrides for cache toggles and auto refresh intervals.

## Runtime Flow
1. **Identity & RBAC**: `DataService.getIdentity()` queries `eros_source.scheduler_assignments` for scheduler metadata. Every downstream fetch is filtered by the active user.
2. **Data Retrieval**: `BigQueryService` centralizes parameterized queries, honoring script cache with hashed request payloads.
3. **Sheet Rendering**: Dedicated modules (`ControlHub`, `TodayPlanner`, etc.) hydrate sheets, with smart defaults and data validation.
4. **Sidebar Workflow**: Custom HTML sidebar drives user actions (load, preflight, caption fetch, submit). Sidebar calls Apps Script endpoints defined in `main.ts`.
5. **Preflight**: `PreflightService` inspects spacing, fatigue, mandatory coverage, and tier pricing guardrails before submission. Findings write to `Diagnostics`.
6. **Submission**: `LoggingService.submitActions()` writes structured payloads to `eros_ops.send_log` using BigQuery parameterized inserts. No other writes are permitted.
7. **Automation**: `installTriggers` seeds a 15-minute refresh trigger. Manual menu commands mirror sidebar operations.

## BigQuery Dependencies
- `eros_messaging_mart.enhanced_daily_recommendations`
- `eros_messaging_feat.authenticity_monitor`
- `eros_messaging_mart.caption_rank_next24_v3_tbl`
- `eros_messaging_feat.caption_rank_next24_by_type`
- `eros_messaging_srv.scheduler_dashboard`
- `eros_source.scheduler_assignments`
- `eros_messaging_feat.tier_baseline_templates`
- `eros_ops.send_log`

## Guardrails
- Parameterized SQL everywhere to prevent injection and quoting issues.
- Structured logging to Diagnostics sheet for every preflight run and critical failure.
- Pricing guard checks leverage tier templates; manager overrides can be layered in LoggingService if needed.
- Cached query results respect TTL from the Settings sheet (`ENABLE_CACHE`, `CACHE_TTL_SEC`).

## Deployment Steps
1. `npm install`
2. `npm run build` (outputs to `dist/` and copies sidebar HTML)
3. `clasp create --title "EROS Scheduler Hub" --type sheets`
4. `npm run push`
5. Authorize, open sidebar (`🚀 EROS Scheduler Hub → Open Sidebar`), run `Load Today` and `Run Preflight`.

## Future Enhancements
- Persist randomized offsets per row and add manager override workflow UI in sidebar.
- Extend Performance Pulse with tier drift metrics from `eros_messaging_mart.tier_performance_analysis`.
- Add Slack webhook integration triggered from `Diagnostics` for repeated failures.
