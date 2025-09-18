// Function to standardize username formatting
function df_std_username(username_col) {
  return `LOWER(TRIM(${username_col}))`;
}

// Make function available globally
global.df_std_username = df_std_username;