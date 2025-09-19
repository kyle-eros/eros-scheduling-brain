# EROS Data Pipeline Setup Guide

This document outlines the setup process for the EROS intelligence engine data pipeline.

## Prerequisites

- BigQuery access to project `of-scheduler-proj`
- Dataform CLI installed (`npm install -g @dataform/cli`)
- `bq` command line tool configured

## BigQuery Dataset Structure

The pipeline uses the following datasets:

### Core Data
- `eros_core_dim` - Core dimension tables
- `eros_source` - Raw source data

### Messaging Pipeline
- `eros_messaging_stg` - Staging layer
- `eros_messaging_feat` - Feature engineering
- `eros_messaging_mart` - Data marts
- `eros_messaging_srv` - Service layer

### Operations Pipeline
- `eros_ops_stg` - Operations staging
- `eros_ops_feat` - Operations features
- `eros_ops_mart` - Operations marts

### Other
- `eros_pricing_feat` - Pricing features
- `eros_assertions` - Data quality tests

## Key Tables and Specifications

### Partitioned Tables
- `eros_messaging_stg.captions` - Partitioned by `loaded_date`, clustered by `caption_type, username_std`
- `eros_messaging_stg.mass_messages` - Partitioned by `sending_date`, clustered by `username_std`
- `eros_messaging_feat.messages_enriched` - Partitioned by `sending_date`, clustered by `username_std`

### Clustered Tables
- `eros_ops_stg.scheduler_overrides_ext` - Clustered by `username_std`

## Running the Pipeline

1. **Compile**: `dataform compile`
2. **Test**: `dataform run --dry-run`
3. **Execute**: `dataform run` (use `--full-refresh` for first run)

## Troubleshooting

### Partitioning Conflicts
If you see "Cannot replace a table with a different partitioning spec" errors:

1. Drop the conflicting table: `bq rm -f project:dataset.table`
2. Let Dataform recreate it with correct specifications

### Missing Source Data
The pipeline requires source tables in `eros_source` dataset. Sample data is created during setup.