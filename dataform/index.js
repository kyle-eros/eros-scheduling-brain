// EROS Intelligence Engine - Main entry point
const { df_mk_sk, df_safe_divide, df_std_username, df_to_local } = require('./includes/index.js');

// Make functions globally available
global.df_mk_sk = df_mk_sk;
global.df_safe_divide = df_safe_divide;
global.df_std_username = df_std_username;
global.df_to_local = df_to_local;