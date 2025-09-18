// Function to create deterministic surrogate keys using FARM_FINGERPRINT
function df_mk_sk(columns) {
  return `FARM_FINGERPRINT(CONCAT(${columns.join(', ')}))`;
}

// Make function available globally
global.df_mk_sk = df_mk_sk;