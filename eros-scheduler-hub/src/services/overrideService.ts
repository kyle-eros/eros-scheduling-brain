import {CONFIG} from '../config';
import {BigQueryService} from './bigquery';
import {TodayRow} from './dataService';

const {projectId, datasets, tables, timezone} = CONFIG;
const ops = `${projectId}.eros_ops_stg`;

const stringParam = (name: string, value: string): GoogleAppsScript.BigQuery.Schema.QueryParameter => ({
  name,
  parameterType: {type: 'STRING'},
  parameterValue: {value}
});

interface TierBand {
  prem_min?: number | null;
  prem_max?: number | null;
  mid_min?: number | null;
  mid_max?: number | null;
  tea_min?: number | null;
  tea_max?: number | null;
}

export interface PriceViolation {
  row: number;
  creator: string;
  tierId: string;
  band: 'prem' | 'mid' | 'tea';
  min: number | null;
  max: number | null;
  price: number;
}

export class OverrideService {
  private readonly bq = new BigQueryService();
  private readonly tierCache = new Map<string, TierBand>();

  /**
   * Check if the current user is a manager with override privileges
   */
  isManager(): boolean {
    // Check scheduler_roster first
    const sql1 = `
      SELECT CAST(is_manager AS BOOL) AS is_mgr
      FROM \`${projectId}.${datasets.source}.scheduler_roster\`
      WHERE LOWER(scheduler_email) = LOWER(SESSION_USER())
      LIMIT 1
    `;
    try {
      const result = this.bq.query<{is_mgr: boolean}>(sql1);
      if (result.length && Boolean(result[0].is_mgr) === true) {
        return true;
      }
    } catch (e) {
      // Table might not exist, try fallback
    }

    // Fallback to scheduler_assignments
    const sql2 = `
      SELECT CAST(is_manager AS BOOL) AS is_mgr
      FROM \`${projectId}.${datasets.source}.scheduler_assignments\`
      WHERE LOWER(scheduler_email) = LOWER(SESSION_USER())
      LIMIT 1
    `;
    try {
      const result = this.bq.query<{is_mgr: any}>(sql2);
      return result.length > 0 && Boolean(result[0].is_mgr) === true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Validate prices against tier bands for all rows
   */
  validatePrices(rows: TodayRow[]): PriceViolation[] {
    const violations: PriceViolation[] = [];

    rows.forEach((row, index) => {
      if (!row.full_tier_assignment || !row.suggested_price) return;

      const bands = this.getTierBands(row.full_tier_assignment);
      if (!bands) return;

      const bandKey = this.mapBand(row.price_tier);
      if (!bandKey) return;

      const [min, max] = this.pickRange(bands, bandKey);
      const price = Number(row.suggested_price);

      if ((min !== null && min !== undefined && price < min) ||
          (max !== null && max !== undefined && price > max)) {
        violations.push({
          row: index + 2, // Sheet row (accounting for header)
          creator: row.username_std,
          tierId: row.full_tier_assignment,
          band: bandKey,
          min: min ?? null,
          max: max ?? null,
          price
        });
      }
    });

    return violations;
  }

  /**
   * Log price overrides to BigQuery
   */
  logOverrides(violations: PriceViolation[], reason: string, schedulerEmail: string): void {
    if (!violations.length) return;

    // Generate UUID for each override
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
    } catch (e) {
      // Fallback to send_log if overrides table doesn't exist
      this.logOverridesToSendLog(violations, reason, schedulerEmail);
    }
  }

  /**
   * Fallback: log to send_log if overrides table unavailable
   */
  private logOverridesToSendLog(violations: PriceViolation[], reason: string, schedulerEmail: string): void {
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

  private getTierBands(tierId: string): TierBand | null {
    if (!tierId) return null;
    if (this.tierCache.has(tierId)) {
      return this.tierCache.get(tierId) ?? null;
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

    const rows = this.bq.query<TierBand>(sql, [stringParam('tier', tierId)]);
    const data = rows[0] || null;
    this.tierCache.set(tierId, data);
    return data;
  }

  private pickRange(bands: TierBand, key: 'prem' | 'mid' | 'tea'): [number | null | undefined, number | null | undefined] {
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

  private mapBand(priceTier: string): 'prem' | 'mid' | 'tea' | null {
    const normalized = priceTier?.toUpperCase?.() ?? '';
    if (['PREMIUM', 'HIGH'].includes(normalized)) return 'prem';
    if (['MEDIUM', 'MID', 'CORE'].includes(normalized)) return 'mid';
    if (['TEASER', 'LOW'].includes(normalized)) return 'tea';
    return null;
  }
}
