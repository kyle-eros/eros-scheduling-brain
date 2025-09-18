// Function to convert UTC timestamp to local time using timezone
function df_to_local(utc_timestamp, timezone_col) {
  return `DATETIME(${utc_timestamp}, ${timezone_col})`;
}

// Make function available globally
global.df_to_local = df_to_local;