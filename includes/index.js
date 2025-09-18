// EROS Intelligence Engine - Custom function definitions

// Function to create deterministic surrogate keys using FARM_FINGERPRINT
function df_mk_sk(columns) {
  return `FARM_FINGERPRINT(CONCAT(${columns.join(', ')}))`;
}

// Function for safe division to avoid divide by zero errors
function df_safe_divide(numerator, denominator) {
  return `SAFE_DIVIDE(${numerator}, ${denominator})`;
}

// Function to standardize username formatting
function df_std_username(username_col) {
  return `LOWER(TRIM(${username_col}))`;
}

// Function to convert UTC timestamp to local time using timezone
function df_to_local(utc_timestamp, timezone_col) {
  return `DATETIME(${utc_timestamp}, ${timezone_col})`;
}

// Export functions
module.exports = {
  df_mk_sk,
  df_safe_divide,
  df_std_username,
  df_to_local
};