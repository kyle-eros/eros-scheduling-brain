import {CONFIG} from '../config';

const HASH_KEY_MAX = 120;

type QueryParameter = GoogleAppsScript.BigQuery.Schema.QueryParameter;

type QueryRequest = GoogleAppsScript.BigQuery.Schema.QueryRequest;

type QueryResponse = GoogleAppsScript.BigQuery.Schema.QueryResponse;

type Cache = GoogleAppsScript.Cache.Cache;

const md5 = (input: string): string => {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, input);
  return digest.map((b) => (('0' + ((b & 0xff).toString(16))).slice(-2))).join('');
};

export class BigQueryService {
  private readonly projectId = CONFIG.projectId;
  private readonly cache: Cache | null;
  private readonly cacheEnabled: boolean;
  private readonly ttlSeconds: number;

  constructor() {
    this.cacheEnabled = CONFIG.cache.enabled;
    this.ttlSeconds = CONFIG.cache.ttlSeconds;
    this.cache = this.cacheEnabled ? CacheService.getScriptCache() : null;
  }

  query<T = Record<string, unknown>>(sql: string, params: QueryParameter[] = []): T[] {
    const request: QueryRequest = {
      useLegacySql: false,
      parameterMode: params.length ? 'NAMED' : 'POSITIONAL',
      query: sql,
      queryParameters: params
    };

    const cacheKey = this.cacheEnabled ? this.buildCacheKey(request) : null;
    if (cacheKey && this.cache) {
      const hit = this.cache.get(cacheKey);
      if (hit) {
        return JSON.parse(hit) as T[];
      }
    }

    const response: QueryResponse = BigQuery!.Jobs!.query(request, this.projectId);
    if (response.jobComplete !== true) {
      throw new Error('BigQuery query did not complete.');
    }
    const fields = response.schema?.fields ?? [];
    const rows = (response.rows ?? []).map((row: any) => {
      const values = row.f ?? [];
      const record: Record<string, unknown> = {};
      fields.forEach((field: any, index: number) => {
        record[field.name ?? `field_${index}`] = values[index]?.v ?? null;
      });
      return record as T;
    });

    if (cacheKey && this.cache) {
      this.cache.put(cacheKey, JSON.stringify(rows), this.ttlSeconds);
    }
    return rows;
  }

  insert(sql: string, params: QueryParameter[] = []): void {
    const request: QueryRequest = {
      useLegacySql: false,
      parameterMode: params.length ? 'NAMED' : 'POSITIONAL',
      query: sql,
      queryParameters: params
    };
    const response = BigQuery!.Jobs!.query(request, this.projectId);
    if (response.jobComplete !== true) {
      throw new Error('BigQuery insert failed to complete.');
    }
  }

  private buildCacheKey(request: QueryRequest): string {
    const payload = JSON.stringify(request);
    const digest = md5(payload);
    return digest.substring(0, HASH_KEY_MAX);
  }
}
