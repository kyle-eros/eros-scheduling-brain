Pair-programmer guide to ship the EROS Dataform pipeline fix. Follow each section in order; stop and surface any failure immediately.

⸻

🔧 **Objective**
- Deliver branch `fix/full-refresh-green-2025-09-30` ready for UI end-to-end runs (full refresh, assertions gated by vars, compile clean).
- Preserve the STRUCT normalization, alias corrections, partition filters, and tier assertion work from the prior session.

⸻

**1. Branch Prep**
- `git fetch --all --prune`
- `git checkout fix/full-refresh-green-2025-09-30`
- `git pull --rebase`
- `npm run compile`
- If compile fails, halt, capture the file + snippet, and exit.

⸻

**2. Canonical Var Gates**
- Every assertion referencing `enable_strict_freshness` must use:
  `disabled: ${ !(dataform.projectConfig.vars && (dataform.projectConfig.vars.enable_strict_freshness === true || dataform.projectConfig.vars.enable_strict_freshness === "true")) }`
- Every assertion referencing `enable_partition_slo` must use:
  `disabled: ${ !(dataform.projectConfig.vars && (dataform.projectConfig.vars.enable_partition_slo === true || dataform.projectConfig.vars.enable_partition_slo === "true")) }`
- Apply to:
  `definitions/assertions/freshness/mass_messages_freshness.sqlx`
  `definitions/assertions/freshness/mass_messages_freshness_24h.sqlx`
  `definitions/assertions/freshness/messages_enriched_freshness_24h.sqlx`
  `definitions/assertions/freshness/send_log_freshness_24h.sqlx`
  `definitions/assertions/quality/mass_messages_partition_check.sqlx`
  `definitions/assertions/quality/send_log_partition_check.sqlx`
  …and any assertion referencing those vars. Keep tag lists trailing comma when present.

⸻

**3. Freshness Assertions (CTE pattern)**
- Enforce the exact template below (swap table + column):
  ```sql
  config {
    type: "assertion",
    schema: "eros_assertions",
    description: "<TABLE>: max(<DATE_COL>) within last 24h",
    tags: ["data_quality","freshness"],
    disabled: ${ !(dataform.projectConfig.vars && (dataform.projectConfig.vars.enable_strict_freshness === true || dataform.projectConfig.vars.enable_strict_freshness === "true")) }
  }

  WITH s AS (
    SELECT MAX(<DATE_COL>) AS max_dt
    FROM ${ref("<TABLE>")}
    WHERE <DATE_COL> >= DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
  )
  SELECT *
  FROM s
  WHERE max_dt < DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY);
  ```
- Substitutions: mass_messages (sending_date), mass_messages_24h (sending_date), messages_enriched_24h (sending_date), send_log_24h (action_date).
- Never reintroduce `COALESCE('1900-01-01')`; empty tables must pass (0 rows).

⸻

**4. Partition Presence Assertions**
- Keep the checks data-driven (no INFORMATION_SCHEMA) and gated with the partition SLO expression above.
- Structure:
  ```sql
  config {
    type: "assertion",
    schema: "eros_assertions",
    description: "<TABLE>: partitions present for last <N> days (data-driven)",
    tags: ["data_quality","partition"],
    disabled: ${ !(dataform.projectConfig.vars && (dataform.projectConfig.vars.enable_partition_slo === true || dataform.projectConfig.vars.enable_partition_slo === "true")) }
  }
  WITH days AS (
    SELECT d
    FROM UNNEST(GENERATE_DATE_ARRAY(DATE_SUB(CURRENT_DATE(), INTERVAL <N> DAY), CURRENT_DATE())) d
  ),
  observed AS (
    SELECT DATE(<DATE_COL>) AS d
    FROM ${ref("<TABLE>")}
    WHERE <DATE_COL> BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL <N> DAY) AND CURRENT_DATE()
    GROUP BY 1
  )
  SELECT days.d AS missing_partition_date
  FROM days
  LEFT JOIN observed USING (d)
  WHERE observed.d IS NULL;
  ```
- Apply to `mass_messages_partition_check.sqlx` and `send_log_partition_check.sqlx`; reuse existing day window (7–14d).

⸻

**5. Mass Messages Partition Predicate**
- For every `${ref("mass_messages")}` reader, ensure the outer SELECT includes `WHERE sending_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)`.
- Double-check:
  `definitions/assertions/uniqueness/mass_messages_unique_key.sqlx`
  `definitions/assertions/row_window/mass_messages_row_window.sqlx`
  `definitions/assertions/quality/mass_messages_quality.sqlx`
  Any additional models referencing mass_messages.
- Confirm `definitions/messaging/stg/mass_messages.sqlx` has no `rowConditions` auto-assertion.

⸻

**6. Preserve Critical Fixes**
- `definitions/messaging/feat/tier_baseline_templates.sqlx` → typed STRUCT parity across top-level templates and nested arrays (`ARRAY<STRUCT<...>>`). Spot check with `grep -nE "ARRAY<STRUCT<|STRUCT<" definitions/messaging/feat/tier_baseline_templates.sqlx`.
- `definitions/messaging/mart/caption_rank_next24_v3_tbl.sqlx` → `slot_dt_local` and `hod` sourced from `ts` (`time_slots` alias) and `theme_scoring` cross-joined as `th`. Validate with `grep -nE "time_slots|theme_scoring|slot_dt_local|\bhod\b" definitions/messaging/mart/caption_rank_next24_v3_tbl.sqlx`.

⸻

**7. View & Tier Assertion Sanity**
- `definitions/core/vw_week_slots_7d_rbac.sqlx` → `slot_dt_local` defined in `ts` CTE; every computed column in final SELECT has an alias.
- `definitions/messaging/srv/scheduler_dashboard.sqlx` → explicit aliases on all computed fields.
- `definitions/assertions/acceptance/creator_tier_tier_values.sqlx` → assertion targets `full_tier_assignment` (or current canonical field) and nothing stale.

⸻

**8. Project Vars for UI**
- Ensure root-level `dataform.json` includes:
  ```json
  {
    "warehouse": "bigquery",
    "assertionSchema": "eros_assertions",
    "vars": {
      "enable_strict_freshness": false,
      "enable_partition_slo": false
    }
  }
  ```
- If `dataform/dataform.json` exists, merge keys so the UI reads vars from the root. Keep `includes/index.js` or `index.js` purely for macros.

⸻

**9. Proof Pack + Compile**
- `grep -R "INFORMATION_SCHEMA" -n definitions || echo "OK: none"`
- `grep -R "\${ref(\"mass_messages\")}" -n definitions | cut -d: -f1 | sort -u | xargs -I{} bash -lc 'echo "--- {}"; grep -n "sending_date" "{}" || echo "MISSING WHERE";'`
- `grep -R "rowConditions" -n definitions/messaging/stg/mass_messages.sqlx || echo "OK: none"`
- `grep -nE "time_slots|theme_scoring|slot_dt_local|\bhod\b" definitions/messaging/mart/caption_rank_next24_v3_tbl.sqlx`
- `grep -nE "ARRAY<STRUCT<|STRUCT<" definitions/messaging/feat/tier_baseline_templates.sqlx | head -n 50`
- `grep -n "enable_strict_freshness" -R definitions/assertions`
- `grep -n "enable_partition_slo" -R definitions/assertions`
- `npm run compile`
- If `.df-credentials.json` exists locally: `npx dataform run --tags data_quality --dry-run` (skip otherwise).
- Capture outputs for the commit footer.

⸻

**10. Merge & Push to Main**
- `git checkout main && git pull`
- `git checkout fix/full-refresh-green-2025-09-30`
- `git rebase main` (resolve conflicts if any).
- `git checkout main`
- `git merge --ff-only fix/full-refresh-green-2025-09-30`
- Stage + commit (include proof-pack output in footer); recommended subject:
  `Green full refresh: typed STRUCT templates; caption_rank time alias fix; partitioned freshness CTEs; data-driven partition checks; var-gated SLAs; mass_messages readers date-predicated.`
- `git push origin main`
- Return latest main commit hash and the compile summary.

⸻

**Why This Holds**
- Canonical gates keep freshness/partition SLAs opt-in, preventing surprise failures in UI runs.
- Proof pack enforces partition predicates, STRUCT parity, and alias hygiene while guarding against regressions.
- Maintains all prior fixes: STRUCT normalization, time aliasing, view aliasing, and tier assertion alignment.

⸻

**Post-merge Checklist (UI)**
- In Dataform UI select branch `fix/full-refresh-green-2025-09-30`.
- Confirm run variables default to `enable_strict_freshness=false`, `enable_partition_slo=false`.
- Compile (~43 actions expected).
- Optional: run assertions (`data_quality` tag) before the full execution.
- Full run should pass with gates off; flip vars to true only when ready for strict SLAs.
