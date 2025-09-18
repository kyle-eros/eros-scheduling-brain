// Sources declaration for EROS Intelligence Engine
const raw_schema = "eros_source";

// Messaging domain sources
declare({schema: raw_schema, name: "mass_message_daily_final"});
declare({schema: raw_schema, name: "mass_message_inactive_final"});
declare({schema: raw_schema, name: "caption_bank_ppv_final"});
declare({schema: raw_schema, name: "caption_bank_tip_final"});
declare({schema: raw_schema, name: "caption_bank_renew_final"});
declare({schema: raw_schema, name: "caption_bank_bump_final"});

// Core domain sources  
declare({schema: raw_schema, name: "creator_statistics_final"});
declare({schema: raw_schema, name: "scheduler_assignments_final"});

// External sources (Google Sheets via External Tables)
declare({schema: raw_schema, name: "scheduler_overrides_external"});