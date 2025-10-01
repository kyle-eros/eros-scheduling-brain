"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BigQueryService = void 0;
const config_1 = require("../config");
const HASH_KEY_MAX = 120;
const md5 = (input) => {
    const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, input);
    return digest.map((b) => (('0' + ((b & 0xff).toString(16))).slice(-2))).join('');
};
class BigQueryService {
    constructor() {
        this.projectId = config_1.CONFIG.projectId;
        this.cacheEnabled = config_1.CONFIG.cache.enabled;
        this.ttlSeconds = config_1.CONFIG.cache.ttlSeconds;
        this.cache = this.cacheEnabled ? CacheService.getScriptCache() : null;
    }
    query(sql, params = []) {
        var _a, _b, _c;
        const request = {
            useLegacySql: false,
            parameterMode: params.length ? 'NAMED' : 'POSITIONAL',
            query: sql,
            queryParameters: params
        };
        const cacheKey = this.cacheEnabled ? this.buildCacheKey(request) : null;
        if (cacheKey && this.cache) {
            const hit = this.cache.get(cacheKey);
            if (hit) {
                return JSON.parse(hit);
            }
        }
        const response = BigQuery.Jobs.query(request, this.projectId);
        if (response.jobComplete !== true) {
            throw new Error('BigQuery query did not complete.');
        }
        const fields = (_b = (_a = response.schema) === null || _a === void 0 ? void 0 : _a.fields) !== null && _b !== void 0 ? _b : [];
        const rows = ((_c = response.rows) !== null && _c !== void 0 ? _c : []).map((row) => {
            var _a;
            const values = (_a = row.f) !== null && _a !== void 0 ? _a : [];
            const record = {};
            fields.forEach((field, index) => {
                var _a, _b, _c;
                record[(_a = field.name) !== null && _a !== void 0 ? _a : `field_${index}`] = (_c = (_b = values[index]) === null || _b === void 0 ? void 0 : _b.v) !== null && _c !== void 0 ? _c : null;
            });
            return record;
        });
        if (cacheKey && this.cache) {
            this.cache.put(cacheKey, JSON.stringify(rows), this.ttlSeconds);
        }
        return rows;
    }
    insert(sql, params = []) {
        const request = {
            useLegacySql: false,
            parameterMode: params.length ? 'NAMED' : 'POSITIONAL',
            query: sql,
            queryParameters: params
        };
        const response = BigQuery.Jobs.query(request, this.projectId);
        if (response.jobComplete !== true) {
            throw new Error('BigQuery insert failed to complete.');
        }
    }
    buildCacheKey(request) {
        const payload = JSON.stringify(request);
        const digest = md5(payload);
        return digest.substring(0, HASH_KEY_MAX);
    }
}
exports.BigQueryService = BigQueryService;
