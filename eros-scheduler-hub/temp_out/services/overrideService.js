"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OverrideService = void 0;
const config_1 = require("../config");
const bigquery_1 = require("./bigquery");
const { projectId, datasets, tables, timezone } = config_1.CONFIG;
const ops = `${projectId}.eros_ops_stg`;
const stringParam = (name, value) => ({
    name,
    parameterType: { type: 'STRING' },
    parameterValue: { value }
});
class OverrideService {
    constructor() {
        this.bq = new bigquery_1.BigQueryService();
        this.tierCache = new Map();
    }
    isManager() {
        const sql1 = `
      SELECT CAST(is_manager AS BOOL) AS is_mgr
      FROM \`${projectId}.${datasets.source}.scheduler_roster\`
      WHERE LOWER(scheduler_email) = LOWER(SESSION_USER())
      LIMIT 1
    `;
        try {
            const result = this.bq.query(sql1);
            if (result.length && Boolean(result[0].is_mgr) === true) {
                return true;
            }
        }
        catch (e) {
        }
        const sql2 = `
      SELECT CAST(is_manager AS BOOL) AS is_mgr
      FROM \`${projectId}.${datasets.source}.scheduler_assignments\`
      WHERE LOWER(scheduler_email) = LOWER(SESSION_USER())
      LIMIT 1
    `;
        try {
            const result = this.bq.query(sql2);
            return result.length > 0 && Boolean(result[0].is_mgr) === true;
        }
        catch (e) {
            return false;
        }
    }
    validatePrices(rows) {
        const violations = [];
        rows.forEach((row, index) => {
            if (!row.full_tier_assignment || !row.suggested_price)
                return;
            const bands = this.getTierBands(row.full_tier_assignment);
            if (!bands)
                return;
            const bandKey = this.mapBand(row.price_tier);
            if (!bandKey)
                return;
            const [min, max] = this.pickRange(bands, bandKey);
            const price = Number(row.suggested_price);
            if ((min !== null && min !== undefined && price < min) ||
                (max !== null && max !== undefined && price > max)) {
                violations.push({
                    row: index + 2,
                    creator: row.username_std,
                    tierId: row.full_tier_assignment,
                    band: bandKey,
                    min: min !== null && min !== void 0 ? min : null,
                    max: max !== null && max !== void 0 ? max : null,
                    price
                });
            }
        });
        return violations;
    }
    logOverrides(violations, reason, schedulerEmail) {
        if (!violations.length)
            return;
        const values = violations.map(v => `STRUCT(
      GENERATE_UUID(),
      CURRENT_TIMESTAMP(),
      CURRENT_DATE('${timezone}'),
      '${v.creator}',
      '${v.tierId}',
      '${v.band}',
      ${v.min === null ? 'NULL' : v.min},
      ${v.max === null ? 'NULL' : v.max},
      ${v.price},
      '${String(reason || '').replace(/'/g, "\\'")}',
      '${schedulerEmail}'
    )`).join(',');
        const sql = `
      INSERT \`${ops}.scheduler_overrides_ext\`
        (override_id, override_ts, override_date, username_std, tier_id,
         price_band, min_allowed, max_allowed, price_entered, reason, scheduler_email)
      SELECT * FROM UNNEST([${values}])
    `;
        try {
            this.bq.insert(sql);
        }
        catch (e) {
            this.logOverridesToSendLog(violations, reason, schedulerEmail);
        }
    }
    logOverridesToSendLog(violations, reason, schedulerEmail) {
        const values = violations.map(v => `STRUCT(
      CURRENT_TIMESTAMP(),
      CURRENT_DATE('${timezone}'),
      CONCAT('OVERRIDE|', '${v.tierId}', '|', '${v.band}'),
      '${v.creator}',
      'main',
      CONCAT('${v.creator}', '__main'),
      CAST(NULL AS STRING),
      '${schedulerEmail}',
      CURRENT_DATE('${timezone}'),
      0,
      ${v.price},
      '',
      'Override',
      'price_override',
      'sheets_hub_v2'
    )`).join(',');
        const sql = `
      INSERT \`${projectId}.${datasets.ops}.${tables.sendLog}\`
        (action_ts, action_date, tracking_hash, username_std, page_type, username_page,
         scheduler_code, scheduler_email, date_local, hod_local, price_usd, caption_id,
         status, action, source)
      SELECT * FROM UNNEST([${values}])
    `;
        this.bq.insert(sql);
    }
    getTierBands(tierId) {
        var _a;
        if (!tierId)
            return null;
        if (this.tierCache.has(tierId)) {
            return (_a = this.tierCache.get(tierId)) !== null && _a !== void 0 ? _a : null;
        }
        const sql = `
      SELECT
        premium_price_range.min AS prem_min,
        premium_price_range.max AS prem_max,
        mid_price_range.min AS mid_min,
        mid_price_range.max AS mid_max,
        teaser_price_range.min AS tea_min,
        teaser_price_range.max AS tea_max
      FROM \`${projectId}.${datasets.feat}.${tables.tierTemplates}\`
      WHERE tier_id = @tier
      LIMIT 1
    `;
        const rows = this.bq.query(sql, [stringParam('tier', tierId)]);
        const data = rows[0] || null;
        this.tierCache.set(tierId, data);
        return data;
    }
    pickRange(bands, key) {
        switch (key) {
            case 'prem':
                return [bands.prem_min, bands.prem_max];
            case 'mid':
                return [bands.mid_min, bands.mid_max];
            case 'tea':
                return [bands.tea_min, bands.tea_max];
            default:
                return [null, null];
        }
    }
    mapBand(priceTier) {
        var _a, _b;
        const normalized = (_b = (_a = priceTier === null || priceTier === void 0 ? void 0 : priceTier.toUpperCase) === null || _a === void 0 ? void 0 : _a.call(priceTier)) !== null && _b !== void 0 ? _b : '';
        if (['PREMIUM', 'HIGH'].includes(normalized))
            return 'prem';
        if (['MEDIUM', 'MID', 'CORE'].includes(normalized))
            return 'mid';
        if (['TEASER', 'LOW'].includes(normalized))
            return 'tea';
        return null;
    }
}
exports.OverrideService = OverrideService;
