// Sources declaration for EROS Intelligence Engine
const raw_schema = "eros_source";

// Messaging domain sources
declare({schema: raw_schema, name: "mass_message_daily_final"});
declare({schema: raw_schema, name: "facts_messages_all"});
declare({schema: raw_schema, name: "caption_bank_ppv_final"});
declare({schema: raw_schema, name: "caption_bank_tip_final"});
declare({schema: raw_schema, name: "caption_bank_renew_final"});
declare({schema: raw_schema, name: "caption_bank_bump_final"});

// Core domain sources
declare({schema: raw_schema, name: "creator_statistics_final"});
// Note: scheduler_assignments is defined as a table in definitions/sources/scheduler_assignments.sqlx
// So we don't need to declare it here

// External sources (Google Sheets via External Tables)
declare({schema: raw_schema, name: "scheduler_overrides_external"});