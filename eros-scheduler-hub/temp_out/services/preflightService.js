"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreflightService = void 0;
const config_1 = require("../config");
const bigquery_1 = require("./bigquery");
const { projectId, datasets, tables, timezone } = config_1.CONFIG;
const mart = `${projectId}.${datasets.mart}`;
const feat = `${projectId}.${datasets.feat}`;
const stringParam = (name, value) => ({
    name,
    parameterType: { type: 'STRING' },
    parameterValue: { value }
});
const md5 = (input) => {
    const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, input);
    return digest.map((b) => (('0' + ((b & 0xff).toString(16))).slice(-2))).join('');
};
class PreflightService {
    constructor() {
        this.bq = new bigquery_1.BigQueryService();
        this.tierCache = new Map();
        this.lastPriceViolations = [];
    }
    evaluate(todayRows, options = {}) {
        const issues = [];
        issues.push(...this.evaluateSpacing(todayRows));
        issues.push(...this.evaluateFatigue(todayRows));
        issues.push(...this.evaluateMandatory(todayRows));
        issues.push(...this.evaluatePricing(todayRows));
        if (options.requireCaptions) {
            issues.push({
                category: 'caption',
                severity: 'info',
                message: 'Caption readiness enforced by sheet validation.'
            });
        }
        return issues.sort((a, b) => (a.severity < b.severity ? -1 : a.severity > b.severity ? 1 : 0));
    }
    getLastPriceViolations() {
        return this.lastPriceViolations;
    }
    evaluateSpacing(rows) {
        const map = new Map();
        rows.forEach((row) => {
            var _a;
            const dt = new Date(row.recommended_send_ts);
            const arr = (_a = map.get(row.username_std)) !== null && _a !== void 0 ? _a : [];
            arr.push(dt);
            map.set(row.username_std, arr);
        });
        const offenders = [];
        map.forEach((dates, creator) => {
            dates.sort((a, b) => a.getTime() - b.getTime());
            for (let i = 1; i < dates.length; i += 1) {
                const gap = (dates[i].getTime() - dates[i - 1].getTime()) / 60000;
                if (gap > 0 && gap < 60) {
                    offenders.push(`${creator} (${Math.round(gap)} min)`);
                    break;
                }
            }
        });
        if (!offenders.length)
            return [];
        return [{
                category: 'spacing',
                severity: 'warning',
                message: `Tight spacing detected (<60 min) for ${offenders.length} creator(s).`,
                context: { offenders }
            }];
    }
    evaluateFatigue(rows) {
        const highRisk = rows.filter((row) => Number(row.fatigue_safety_score) < 30)
            .map((row) => `${row.username_std} (${row.fatigue_safety_score})`);
        if (!highRisk.length)
            return [];
        return [{
                category: 'fatigue',
                severity: 'warning',
                message: `High fatigue risk (<30) for ${highRisk.length} slot(s).`,
                context: { highRisk }
            }];
    }
    evaluateMandatory(rows) {
        const mandatory = rows.filter((row) => row.is_mandatory);
        if (!mandatory.length)
            return [];
        const byCreator = mandatory.reduce((acc, row) => {
            var _a;
            acc[row.username_std] = ((_a = acc[row.username_std]) !== null && _a !== void 0 ? _a : 0) + 1;
            return acc;
        }, {});
        return [{
                category: 'mandatory',
                severity: 'info',
                message: 'Mandatory coverage summary.',
                context: byCreator
            }];
    }
    evaluatePricing(rows) {
        const violations = [];
        const detailedViolations = [];
        rows.forEach((row, index) => {
            if (!row.suggested_price || !row.price_tier)
                return;
            const bands = this.getTierBands(row.full_tier_assignment);
            if (!bands)
                return;
            const bandKey = this.mapBand(row.price_tier);
            if (!bandKey) {
                violations.push(`${row.username_std} • Unknown price tier ${row.price_tier}`);
                return;
            }
            const [min, max] = this.pickRange(bands, bandKey);
            const price = Number(row.suggested_price);
            if ((min !== null && min !== undefined && price < min) || (max !== null && max !== undefined && price > max)) {
                violations.push(`${row.username_std} • ${price.toFixed(2)} vs [${min !== null && min !== void 0 ? min : '?'} - ${max !== null && max !== void 0 ? max : '?'}] (${bandKey})`);
                detailedViolations.push({
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
        this.lastPriceViolations = detailedViolations;
        if (!violations.length)
            return [];
        return [{
                category: 'price',
                severity: 'error',
                message: 'Price outside tier guardrail.',
                context: { violations }
            }];
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
      FROM \`${mart}.${tables.tierTemplates}\`
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
    static trackingHash(row) {
        const payload = [
            row.username_std,
            row.page_type,
            row.message_type,
            row.recommended_send_ts
        ].join('|');
        return md5(payload);
    }
}
exports.PreflightService = PreflightService;
