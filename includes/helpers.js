// EROS Intelligence Engine - Helper functions for Dataform models
// These functions are made available globally to SQLX files

const VALID_DATE_DIFF_UNITS = new Set([
  'MICROSECOND',
  'MILLISECOND',
  'SECOND',
  'MINUTE',
  'HOUR',
  'DAY',
  'WEEK',
  'MONTH',
  'QUARTER',
  'YEAR'
]);

const NUMERIC_TYPES = new Set(['NUMERIC', 'BIGNUMERIC', 'FLOAT64', 'INT64']);

function assertNonEmptyArray(value, helperName) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${helperName} requires a non-empty array of SQL expressions.`);
  }
  return value;
}

function normalizeTimezoneExpression(expression) {
  if (!expression) {
    return `'UTC'`;
  }
  const trimmed = String(expression).trim();
  const isLiteral = trimmed.startsWith("'") && trimmed.endsWith("'");
  return isLiteral ? trimmed : `COALESCE(${expression}, 'UTC')`;
}

// Deterministic surrogate key using FARM_FINGERPRINT over a canonical JSON payload.
function df_mk_sk(expressions) {
  const safeExpressions = assertNonEmptyArray(expressions, 'df_mk_sk').map((expression, index) => {
    return `${expression} AS col_${index}`;
  });
  return `FARM_FINGERPRINT(TO_JSON_STRING(STRUCT(${safeExpressions.join(', ')})))`;
}

// Wrapper around SAFE_DIVIDE that optionally falls back to a provided default.
function df_safe_divide(numerator, denominator, defaultValue = 'NULL') {
  const fallback = defaultValue === undefined ? 'NULL' : defaultValue;
  return `COALESCE(SAFE_DIVIDE(${numerator}, ${denominator}), ${fallback})`;
}

// Normalize creator usernames for consistent joins.
function df_std_username(columnExpression) {
  return `LOWER(REGEXP_REPLACE(TRIM(${columnExpression}), r'[^a-z0-9_]', '_'))`;
}

// Convert a UTC timestamp to the requested local timezone.
function df_to_local(utcTimestampExpression, timezoneExpression = `'UTC'`, target = 'DATETIME') {
  const tzExpr = normalizeTimezoneExpression(timezoneExpression);
  const normalizedTarget = String(target).toUpperCase();
  const datetimeExpr = `DATETIME(${utcTimestampExpression}, ${tzExpr})`;

  if (normalizedTarget === 'DATETIME') {
    return datetimeExpr;
  }
  if (normalizedTarget === 'DATE') {
    return `DATE(${datetimeExpr})`;
  }
  if (normalizedTarget === 'TIMESTAMP') {
    return `TIMESTAMP(${datetimeExpr}, ${tzExpr})`;
  }

  throw new Error(`df_to_local received unsupported target type: ${target}`);
}

// Helper for date differences with guardrails around allowed units.
function df_date_diff(startDateExpression, endDateExpression, unit = 'DAY') {
  const normalizedUnit = String(unit).toUpperCase().replace(/'/g, '');
  if (!VALID_DATE_DIFF_UNITS.has(normalizedUnit)) {
    throw new Error(`df_date_diff received unsupported unit: ${unit}`);
  }
  return `DATE_DIFF(${endDateExpression}, ${startDateExpression}, '${normalizedUnit}')`;
}

// Safely cast textual numeric fields after removing formatting noise.
function df_safe_cast_numeric(columnExpression, targetType = 'NUMERIC') {
  const normalizedType = String(targetType).toUpperCase();
  if (!NUMERIC_TYPES.has(normalizedType)) {
    throw new Error(`df_safe_cast_numeric received unsupported target type: ${targetType}`);
  }
  const numericRegex = normalizedType === 'INT64' ? `r'[^0-9-]'` : `r'[^0-9.-]'`;
  return `SAFE_CAST(NULLIF(REGEXP_REPLACE(${columnExpression}, ${numericRegex}, ''), '') AS ${normalizedType})`;
}

// Export all functions globally for SQLX files
module.exports = {
  df_mk_sk,
  df_safe_divide,
  df_std_username,
  df_to_local,  
  df_date_diff,
  df_safe_cast_numeric
};

// Also make them available globally
global.df_mk_sk = df_mk_sk;
global.df_safe_divide = df_safe_divide;
global.df_std_username = df_std_username;
global.df_to_local = df_to_local;
global.df_date_diff = df_date_diff;
global.df_safe_cast_numeric = df_safe_cast_numeric;
