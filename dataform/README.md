# EROS Intelligence Engine - Dataform Pipeline

## Overview
This Dataform pipeline processes messaging data for the EROS Intelligence Engine, solving 6 core problems:
1. Timing Chaos - Optimizing message send times
2. Pricing Paradox - Finding optimal pricing strategies
3. Fatigue Factor - Preventing subscriber burnout
4. Content Crisis - Improving message quality
5. Quality Variance - Maintaining consistent performance
6. Pattern Blindness - Identifying successful patterns

## Project Structure

```
dataform/
├── dataform.json          # Project configuration
├── package.json           # Node dependencies
├── index.js              # Main entry point
├── includes/             # Custom JavaScript functions
│   └── index.js          # Helper function definitions
├── definitions/          # SQL transformations
│   ├── sources.js        # Source table declarations
│   ├── assertions/       # Data quality checks
│   │   ├── accepted_values/
│   │   ├── freshness/
│   │   └── uniqueness/
│   ├── core/            # Core dimension tables
│   │   └── dim/
│   ├── messaging/       # Messaging domain
│   │   ├── stg/        # Staging layer
│   │   ├── feat/       # Feature engineering
│   │   ├── srv/        # Service layer
│   │   └── mart/       # Data marts
│   ├── ops/            # Operations domain
│   │   ├── stg/
│   │   ├── feat/
│   │   └── mart/
│   └── pricing/        # Pricing domain
│       └── feat/
```

## Data Flow

1. **Sources** → Raw data from BigQuery tables (declared in sources.js)
2. **Staging (stg)** → Cleaned and standardized data
3. **Features (feat)** → Engineered features and calculations
4. **Service (srv)** → Business logic and aggregations
5. **Marts (mart)** → Final analytical outputs

## Key Tables

### Staging Layer
- `mass_messages` - Incremental mass message data with 14-day watermark
- `captions` - Unified caption bank across all message types

### Feature Layer
- `messages_enriched` - Messages with time features and performance metrics
- `creator_heatmap` - Hourly performance patterns by creator
- `caption_theme_signals` - Caption performance analysis
- `fatigue_scores` - Subscriber engagement tracking
- `pricing_bands` - Optimal pricing recommendations

### Mart Layer
- `daily_recommendations` - Main output: ranked daily send recommendations
- `learning_insights` - Analytical insights for continuous improvement
- `scheduler_dashboard` - Dashboard-ready data for scheduling UI

## Setup Instructions

### 1. Prerequisites
- Google Cloud Project: `of-scheduler-proj`
- BigQuery dataset access to `eros_source`
- Dataform CLI or Dataform Web UI access

### 2. Initial Setup
```bash
# Install dependencies
cd dataform
npm install

# Compile the project
dataform compile

# Run all tables
dataform run
```

### 3. Dataform Web UI Setup
1. Connect your repository to Dataform
2. Set up authentication with your Google Cloud project
3. Configure the workspace with:
   - Default database: `of-scheduler-proj`
   - Default location: `US`

### 4. Running the Pipeline

#### Option 1: Run All Tables
```bash
dataform run
```

#### Option 2: Run Specific Tags
```bash
# Run only staging tables
dataform run --tags messaging_stg

# Run only marts
dataform run --tags messaging_mart
```

#### Option 3: Run with Dependencies
```bash
# Run a specific table and its dependencies
dataform run --actions daily_recommendations --include-deps
```

### 5. Validate Locally
```bash
node dataform/validate.js
```

Running the validation script compiles the project, inspects dependency wiring, and prints a concise inventory of tables/assertions so you can confirm the build before deploying.

## Data Quality Checks

The pipeline includes assertions for:
- **Uniqueness**: Ensures message_sk values are unique
- **Freshness**: Validates data recency (< 2 days old)
- **Accepted Values**: Checks price_tier values are valid

Run assertions:
```bash
dataform run --tags data_quality
```

## Incremental Processing

Key tables use incremental processing:
- `mass_messages` - 14-day watermark for late-arriving data
- Partition by `sending_date` for efficient queries
- Clustering by `username_std` for performance

## Custom Functions

Available helper functions in `includes/index.js`:
- `df_mk_sk()` - Deterministic surrogate key fingerprint built on a JSON struct
- `df_safe_divide()` - Wrapper around SAFE_DIVIDE with configurable fallbacks
- `df_std_username()` - Lowercases and sanitizes handles to join-safe tokens
- `df_to_local()` - Render UTC timestamps as DATETIME/DATE/TIMESTAMP in timezone
- `df_date_diff()` - DATE_DIFF helper with allowed units guardrails
- `df_safe_cast_numeric()` - Removes formatting noise before SAFE_CAST to numeric

## Monitoring & Maintenance

### Daily Checks
1. Verify source data freshness
2. Check assertion results
3. Monitor incremental processing

### Weekly Tasks
1. Review data quality metrics
2. Analyze pipeline performance
3. Update documentation as needed

## Troubleshooting

### Common Issues

1. **Partition filter required error**
   - Always include a WHERE clause on partitioned tables
   - Use `sending_date >= DATE_SUB(CURRENT_DATE(), INTERVAL X DAY)`

2. **Missing source data**
   - Verify source tables exist in `eros_source` dataset
   - Check BigQuery permissions

3. **Incremental processing gaps**
   - Check the 14-day watermark is sufficient
   - Verify no data arrives later than 14 days

## Support

For questions or issues:
- Check Dataform logs in the web UI
- Review BigQuery job history
- Validate source data availability

## Version History

- v1.0 (2025-09-20) - Initial pipeline setup with 6-problem framework