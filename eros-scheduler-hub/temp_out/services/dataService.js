"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataService = void 0;
const config_1 = require("../config");
const bigquery_1 = require("./bigquery");
const { projectId, datasets, tables, timezone } = config_1.CONFIG;
const mart = `${projectId}.${datasets.mart}`;
const feat = `${projectId}.${datasets.feat}`;
const srv = `${projectId}.${datasets.srv}`;
const source = `${projectId}.${datasets.source}`;
const ops = `${projectId}.${datasets.ops}`;
const stringParam = (name, value) => ({
    name,
    parameterType: { type: 'STRING' },
    parameterValue: { value }
});
const intParam = (name, value) => ({
    name,
    parameterType: { type: 'INT64' },
    parameterValue: { value: String(value) }
});
const bq = new bigquery_1.BigQueryService();
exports.DataService = {
    getIdentity() {
        const email = Session.getActiveUser().getEmail();
        const sql = `
      SELECT
        scheduler_email,
        scheduler_code,
        scheduler_display_name,
        group_email,
        is_manager
      FROM \`${source}.${tables.tierAssignments}\`
      WHERE LOWER(scheduler_email) = LOWER(@email)
      LIMIT 1
    `;
        const rows = bq.query(sql, [stringParam('email', email)]);
        if (!rows.length) {
            throw new Error(`No scheduler assignment found for ${email}`);
        }
        return rows[0];
    },
    getHomeTiles(email) {
        const sql = `
      WITH my AS (
        SELECT username_std
        FROM \`${source}.${tables.tierAssignments}\`
        WHERE LOWER(scheduler_email) = LOWER(@email)
      )
      SELECT
        COUNT(DISTINCT username_std) AS creators_today,
        COUNT(*) AS total_slots,
        COUNTIF(is_mandatory) AS mandatory_slots,
        COUNTIF(fatigue_safety_score < 40) AS fatigue_watch,
        ROUND(SUM(COALESCE(suggested_price, 0)), 2) AS est_revenue,
        ROUND(AVG(COALESCE(recommendation_score, 0)) * 100, 1) AS avg_score
      FROM \`${mart}.${tables.enhancedDaily}\`
      WHERE recommendation_date = CURRENT_DATE(@tz)
        AND username_std IN (SELECT username_std FROM my)
    `;
        const rows = bq.query(sql, [stringParam('email', email), stringParam('tz', timezone)]);
        const metrics = rows[0] || {
            creators_today: 0,
            total_slots: 0,
            mandatory_slots: 0,
            fatigue_watch: 0,
            est_revenue: 0,
            avg_score: 0
        };
        return [
            { label: 'Creators Today', value: Number(metrics.creators_today || 0), detail: 'Assigned to you' },
            { label: 'Total Slots', value: Number(metrics.total_slots || 0), detail: 'Mandatory + optional' },
            { label: 'Mandatory Slots', value: Number(metrics.mandatory_slots || 0), detail: 'Must send' },
            { label: 'Fatigue Alerts', value: Number(metrics.fatigue_watch || 0), detail: 'Score < 40' },
            { label: 'Est. Revenue', value: Number(metrics.est_revenue || 0), detail: 'Suggested pricing' },
            { label: 'Avg Confidence %', value: Number(metrics.avg_score || 0), detail: 'Mean recommendation score' }
        ];
    },
    getTodayPlan(email) {
        const sql = `
      WITH my AS (
        SELECT username_std
        FROM \`${source}.${tables.tierAssignments}\`
        WHERE LOWER(scheduler_email) = LOWER(@email)
      )
      SELECT
        recommended_send_ts,
        FORMAT_TIMESTAMP('%H:%M', recommended_send_ts, @tz) AS local_time,
        username_std,
        page_handle,
        page_type,
        full_tier_assignment,
        message_type,
        message_subtype,
        recommendation_rank,
        recommendation_score,
        timing_confidence,
        price_tier,
        suggested_price,
        fatigue_safety_score,
        opportunity_quality,
        recommendation_reason,
        time_energy_required,
        caption_guidance,
        spacing_ok,
        is_mandatory
      FROM \`${mart}.${tables.enhancedDaily}\`
      WHERE recommendation_date = CURRENT_DATE(@tz)
        AND username_std IN (SELECT username_std FROM my)
      ORDER BY recommended_send_ts
    `;
        return bq.query(sql, [stringParam('email', email), stringParam('tz', timezone)]);
    },
    getWeekPlan(email) {
        const sql = `
      WITH my AS (
        SELECT username_std
        FROM \`${source}.${tables.tierAssignments}\`
        WHERE LOWER(scheduler_email) = LOWER(@email)
      ),
      windowed AS (
        SELECT
          recommendation_date,
          username_std,
          full_tier_assignment,
          COUNT(*) AS total_slots,
          COUNTIF(is_mandatory) AS mandatory_slots,
          COUNTIF(NOT is_mandatory) AS optional_slots,
          SUM(COALESCE(suggested_price, 0)) AS est_revenue,
          AVG(fatigue_safety_score) AS avg_fatigue,
          AVG(recommendation_score) AS avg_score
        FROM \`${mart}.${tables.enhancedDaily}\`
        WHERE recommendation_date BETWEEN CURRENT_DATE(@tz) AND DATE_ADD(CURRENT_DATE(@tz), INTERVAL 6 DAY)
          AND username_std IN (SELECT username_std FROM my)
        GROUP BY 1, 2, 3
      )
      SELECT
        recommendation_date,
        username_std,
        full_tier_assignment,
        total_slots,
        mandatory_slots,
        optional_slots,
        ROUND(est_revenue, 2) AS est_revenue,
        CASE
          WHEN avg_fatigue < 40 THEN 'HIGH'
          WHEN avg_fatigue < 60 THEN 'MEDIUM'
          ELSE 'LOW'
        END AS fatigue_risk,
        CASE
          WHEN avg_score >= 0.8 THEN 'HIGH'
          WHEN avg_score >= 0.6 THEN 'MEDIUM'
          ELSE 'LOW'
        END AS priority_band
      FROM windowed
      ORDER BY recommendation_date, username_std
    `;
        return bq.query(sql, [stringParam('email', email), stringParam('tz', timezone)]);
    },
    getAuthenticityAlerts(email) {
        const sql = `
      WITH my AS (
        SELECT username_std
        FROM \`${source}.${tables.tierAssignments}\`
        WHERE LOWER(scheduler_email) = LOWER(@email)
      )
      SELECT
        username_std,
        pattern_risk_level,
        msg_count_30d,
        exact_time_repetitions_30d,
        avg_spacing_minutes_30d
      FROM \`${feat}.${tables.authenticity}\`
      WHERE analysis_date = CURRENT_DATE(@tz)
        AND username_std IN (SELECT username_std FROM my)
        AND pattern_risk_level <> 'low'
      ORDER BY pattern_risk_level DESC, msg_count_30d DESC
      LIMIT 25
    `;
        return bq.query(sql, [stringParam('email', email), stringParam('tz', timezone)]);
    },
    getPerformanceMetrics(email) {
        const sql = `
      SELECT
        COUNT(*) AS actions_7d,
        COUNTIF(status = 'Sent') AS sent_7d,
        ROUND(SUM(COALESCE(price_usd, 0)), 2) AS revenue_7d,
        ROUND(AVG(COALESCE(price_usd, 0)), 2) AS avg_ticket
      FROM \`${ops}.${tables.sendLog}\`
      WHERE action_date BETWEEN DATE_SUB(CURRENT_DATE(@tz), INTERVAL 6 DAY) AND CURRENT_DATE(@tz)
        AND LOWER(scheduler_email) = LOWER(@email)
    `;
        const rows = bq.query(sql, [stringParam('email', email), stringParam('tz', timezone)]);
        const metrics = rows[0] || { actions_7d: 0, sent_7d: 0, revenue_7d: 0, avg_ticket: 0 };
        return [
            { metric: 'Actions (7d)', value: Number(metrics.actions_7d || 0), detail: 'Ready + Sent logged' },
            { metric: 'Sent (7d)', value: Number(metrics.sent_7d || 0), detail: 'Status = Sent' },
            { metric: 'Revenue (7d)', value: Number(metrics.revenue_7d || 0), detail: 'Sum price_usd' },
            { metric: 'Avg Ticket', value: Number(metrics.avg_ticket || 0), detail: 'Avg price for submitted actions' }
        ];
    },
    getCaptionSuggestions(creator, hod, slotDate) {
        const params = [stringParam('creator', creator), intParam('hod', hod), stringParam('slotDate', slotDate)];
        const first = bq.query(`SELECT
         CAST(caption_id AS STRING) AS caption_id,
         caption_text,
         'HIGH' AS confidence,
         '24H' AS source
       FROM \`${mart}.${tables.caption24h}\`
       WHERE LOWER(username_page) = LOWER(@creator)
         AND hod = @hod
         AND slot_dt_local = @slotDate
       ORDER BY rn
       LIMIT 10`, params);
        if (first.length)
            return first;
        const second = bq.query(`SELECT
         CAST(caption_id AS STRING) AS caption_id,
         caption_text,
         'MEDIUM' AS confidence,
         'BY_TYPE' AS source
       FROM \`${feat}.${tables.captionByType}\`
       WHERE LOWER(username_page) = LOWER(@creator)
         AND hod = @hod
         AND slot_dt_local = @slotDate
       ORDER BY rn
       LIMIT 10`, params);
        if (second.length)
            return second;
        const third = bq.query(`SELECT
         NULL AS caption_id,
         caption_preview AS caption_text,
         'LOW' AS confidence,
         'BANK' AS source
       FROM \`${srv}.${tables.schedulerDashboard}\`
       WHERE LOWER(username_std) = LOWER(@creator)
       LIMIT 10`, params);
        return third;
    },
    getRecentActions(email) {
        const sql = `
      SELECT
        action_ts,
        username_std,
        status,
        price_usd,
        caption_id,
        hod_local,
        scheduler_email,
        tracking_hash,
        action
      FROM \`${ops}.${tables.sendLog}\`
      WHERE action_date BETWEEN DATE_SUB(CURRENT_DATE(@tz), INTERVAL 6 DAY) AND CURRENT_DATE(@tz)
        AND LOWER(scheduler_email) = LOWER(@email)
      ORDER BY action_ts DESC
      LIMIT 200
    `;
        const rows = bq.query(sql, [stringParam('email', email), stringParam('tz', timezone)]);
        return rows.map((row) => [
            row.action_ts,
            row.username_std,
            row.status,
            Number(row.price_usd || 0),
            row.caption_id,
            Number(row.hod_local || 0),
            row.scheduler_email,
            row.tracking_hash,
            row.action
        ]);
    }
};
