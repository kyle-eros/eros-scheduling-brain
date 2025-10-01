import {CONFIG} from '../config';
import {TodayRow} from './dataService';
import {BigQueryService} from './bigquery';

interface TierBand {
  prem_min?: number | null;
  prem_max?: number | null;
  mid_min?: number | null;
  mid_max?: number | null;
  tea_min?: number | null;
  tea_max?: number | null;
}

export interface PreflightIssue {
  category: 'spacing' | 'fatigue' | 'mandatory' | 'price' | 'caption';
  severity: 'info' | 'warning' | 'error';
  message: string;
  context?: Record<string, unknown>;
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

const {projectId, datasets, tables, timezone} = CONFIG;
const mart = `${projectId}.${datasets.mart}`;
const feat = `${projectId}.${datasets.feat}`;

const stringParam = (name: string, value: string): GoogleAppsScript.BigQuery.Schema.QueryParameter => ({
  name,
  parameterType: {type: 'STRING'},
  parameterValue: {value}
});

const md5 = (input: string): string => {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, input);
  return digest.map((b) => (('0' + ((b & 0xff).toString(16))).slice(-2))).join('');
};

export class PreflightService {
  private readonly bq = new BigQueryService();
  private readonly tierCache = new Map<string, TierBand>();
  private lastPriceViolations: PriceViolation[] = [];

  evaluate(todayRows: TodayRow[], options: {requireCaptions?: boolean} = {}): PreflightIssue[] {
    const issues: PreflightIssue[] = [];

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

  /**
   * Get the price violations from the last evaluation
   */
  getLastPriceViolations(): PriceViolation[] {
    return this.lastPriceViolations;
  }

  private evaluateSpacing(rows: TodayRow[]): PreflightIssue[] {
    const map = new Map<string, Date[]>();
    rows.forEach((row) => {
      const dt = new Date(row.recommended_send_ts);
      const arr = map.get(row.username_std) ?? [];
      arr.push(dt);
      map.set(row.username_std, arr);
    });

    const offenders: string[] = [];
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

    if (!offenders.length) return [];
    return [{
      category: 'spacing',
      severity: 'warning',
      message: `Tight spacing detected (<60 min) for ${offenders.length} creator(s).`,
      context: {offenders}
    }];
  }

  private evaluateFatigue(rows: TodayRow[]): PreflightIssue[] {
    const highRisk = rows.filter((row) => Number(row.fatigue_safety_score) < 30)
      .map((row) => `${row.username_std} (${row.fatigue_safety_score})`);
    if (!highRisk.length) return [];
    return [{
      category: 'fatigue',
      severity: 'warning',
      message: `High fatigue risk (<30) for ${highRisk.length} slot(s).`,
      context: {highRisk}
    }];
  }

  private evaluateMandatory(rows: TodayRow[]): PreflightIssue[] {
    const mandatory = rows.filter((row) => row.is_mandatory);
    if (!mandatory.length) return [];
    const byCreator = mandatory.reduce<Record<string, number>>((acc, row) => {
      acc[row.username_std] = (acc[row.username_std] ?? 0) + 1;
      return acc;
    }, {});
    return [{
      category: 'mandatory',
      severity: 'info',
      message: 'Mandatory coverage summary.',
      context: byCreator
    }];
  }

  private evaluatePricing(rows: TodayRow[]): PreflightIssue[] {
    const violations: string[] = [];
    const detailedViolations: PriceViolation[] = [];

    rows.forEach((row, index) => {
      if (!row.suggested_price || !row.price_tier) return;
      const bands = this.getTierBands(row.full_tier_assignment);
      if (!bands) return;
      const bandKey = this.mapBand(row.price_tier);
      if (!bandKey) {
        violations.push(`${row.username_std} • Unknown price tier ${row.price_tier}`);
        return;
      }
      const [min, max] = this.pickRange(bands, bandKey);
      const price = Number(row.suggested_price);
      if ((min !== null && min !== undefined && price < min) || (max !== null && max !== undefined && price > max)) {
        violations.push(`${row.username_std} • ${price.toFixed(2)} vs [${min ?? '?'} - ${max ?? '?'}] (${bandKey})`);
        detailedViolations.push({
          row: index + 2, // Sheet row accounting for header
          creator: row.username_std,
          tierId: row.full_tier_assignment,
          band: bandKey,
          min: min ?? null,
          max: max ?? null,
          price
        });
      }
    });

    // Store violations for later retrieval
    this.lastPriceViolations = detailedViolations;

    if (!violations.length) return [];
    return [{
      category: 'price',
      severity: 'error',
      message: 'Price outside tier guardrail.',
      context: {violations}
    }];
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
      FROM \`${mart}.${tables.tierTemplates}\`
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

  static trackingHash(row: TodayRow): string {
    const payload = [
      row.username_std,
      row.page_type,
      row.message_type,
      row.recommended_send_ts
    ].join('|');
    return md5(payload);
  }
}
