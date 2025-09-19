// Import df_to_local from includes/index.js to avoid duplication
const { df_to_local } = require('./index');

// Make function available globally
global.df_to_local = df_to_local;