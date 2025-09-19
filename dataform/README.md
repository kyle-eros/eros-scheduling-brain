# EROS Intelligence Engine - Dataform Pipeline

This directory contains the Dataform transformations that power the EROS Intelligence Engine for revenue optimization.

## 🏗️ Architecture

The pipeline is organized into layers following modern data engineering best practices:

### 📁 Directory Structure
```
definitions/
├── core/              # Shared dimensions and core data
│   └── dim/          # Dimension tables
├── messaging/        # Message-related transformations
│   ├── stg/         # Staging transformations
│   ├── feat/        # Feature engineering
│   ├── mart/        # Data marts
│   └── srv/         # Service views/dashboards
├── pricing/         # Pricing analytics
├── ops/            # Operations and learning insights
└── assertions/     # Data quality checks
```

## 🔄 Data Flow

1. **Raw Data** → `eros_source.mass_message_daily_final` (from Gmail-ETL)
2. **Staging** → `eros_messaging_stg.mass_messages` (cleaned & standardized)
3. **Features** → `eros_messaging_feat.messages_enriched` (time features, metrics)
4. **Marts** → `eros_messaging_mart.daily_recommendations` (ML-ready insights)
5. **Services** → `eros_messaging_srv.scheduler_dashboard` (end-user views)

## 🎯 Key Models

### Core Staging
- **`mass_messages.sqlx`** - Main staging table that unions historical and daily data
- **`captions.sqlx`** - Caption bank processing

### Feature Engineering
- **`messages_enriched.sqlx`** - Adds time intelligence and performance metrics
- **`creator_heatmap.sqlx`** - Audience engagement patterns

### Analytics & ML
- **`daily_recommendations.sqlx`** - ML-powered sending recommendations
- **`learning_insights.sqlx`** - Model training insights
- **`fatigue_scores.sqlx`** - Audience fatigue detection

## 🚀 Getting Started

1. **Setup Dataform workspace** with BigQuery connection
2. **Pull this repository** into your Dataform workspace
3. **Configure variables** in `dataform.json`:
   ```json
   {
     "defaultDatabase": "your-project-id",
     "vars": {
       "raw_schema": "eros_source"
     }
   }
   ```
4. **Run compilation** to validate dependencies
5. **Execute incremental runs** or full refresh as needed

## 📊 Data Sources

The pipeline expects these tables in `eros_source`:
- `mass_message_daily_final` - Daily message data from Gmail-ETL
- `facts_messages_all` - Historical message data
- `creator_statistics_final` - Creator metrics
- `scheduler_assignments_final` - Scheduler assignments

## 🔧 Configuration

Key configuration in `dataform.json`:
- **defaultSchema**: `eros_messaging_stg` (staging layer)
- **assertionSchema**: `eros_assertions` (data quality checks)
- **defaultDatabase**: Your GCP project ID
- **vars.raw_schema**: `eros_source` (source data location)

## 📈 Performance Features

- **Partitioning**: All models partitioned by date for performance
- **Clustering**: Clustered by `username_std` for query optimization
- **Incremental processing**: Staging models use 14-day watermarks
- **Data quality**: Comprehensive assertions and freshness checks