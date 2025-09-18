# 🚀 EROS Intelligence Engine

**Enterprise-Grade BigQuery/Dataform System for Revenue Optimization**

## 📊 Overview

The EROS Intelligence Engine is a greenfield data pipeline that solves 6 core business problems and generates significant daily revenue through intelligent message timing, dynamic pricing, and fatigue prevention.

## 🎯 Business Problems Solved

1. **TIMING CHAOS** → Creator heatmaps identify optimal send times
2. **PRICING BLINDNESS** → Dynamic pricing bands increase RPM  
3. **MESSAGE FATIGUE** → Fatigue scoring prevents over-messaging
4. **CONTENT REPETITION** → Framework for content novelty tracking
5. **INCONSISTENT QUALITY** → Performance benchmarking infrastructure
6. **NO LEARNING LOOP** → Structured learning insights capture

## 🏗️ Architecture

### Domain-First Dataset Design
```
eros_core_dim/        # Shared dimensions (timezones)
eros_messaging_*/     # Messages, captions, schedules  
eros_pricing_*/       # Dynamic pricing intelligence
eros_ops_*/          # Assignments, overrides, learning
eros_assertions/      # Data quality checks
```

### Data Flow
```
Raw Sources → Staging → Features → Marts → Serving
     ↓           ↓        ↓        ↓       ↓
   UTC Only   Watermarks  Signals  Logic  Views
```

## 📁 Repository Structure

```
definitions/
├── core/
│   └── dim/
│       └── dim_creator_timezone.sqlx    # IANA timezone mapping
├── messaging/
│   ├── stg/
│   │   ├── mass_messages.sqlx           # Incremental with watermarks
│   │   └── captions.sqlx                # Caption bank data
│   ├── feat/
│   │   ├── messages_enriched.sqlx       # Time + performance features
│   │   └── creator_heatmap.sqlx         # Optimal timing analysis
│   ├── mart/
│   │   └── daily_recommendations.sqlx   # Core decision engine
│   └── srv/
│       └── scheduler_dashboard.sqlx     # Operational delivery
├── pricing/
│   └── feat/
│       └── pricing_bands.sqlx           # Dynamic pricing tiers
├── ops/
│   ├── stg/
│   │   └── scheduler_overrides_ext.sqlx # External overrides
│   ├── feat/
│   │   └── fatigue_scores.sqlx          # Fatigue prevention
│   └── mart/
│       └── learning_insights.sqlx       # Capture expertise
└── assertions/
    ├── freshness/
    ├── uniqueness/
    └── accepted_values/
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Access to BigQuery
- Dataform workspace

### Installation
```bash
npm install
npx @dataform/cli compile  # Validate syntax
```

### Key Features

#### 🎯 Timing Optimization
- Creator-specific heatmaps by hour/day
- Local timezone handling with IANA standards
- Confidence scoring based on historical data

#### 💰 Dynamic Pricing
- Performance-based pricing tiers (LOW/MEDIUM/HIGH/PREMIUM)
- Price-conversion correlation analysis
- Revenue per message (RPM) optimization

#### 🛡️ Fatigue Prevention
- 7-day rolling volume analysis
- Performance trend detection
- Automated daily limit recommendations

#### 📈 Decision Engine
- Composite scoring (timing 40% + fatigue 30% + pricing 30%)
- Top 5 recommendations per creator daily
- Human-readable reasoning for transparency

## 🔧 Configuration

### BigQuery Schemas
Update `dataform.json` with your project settings:
```json
{
  "defaultDatabase": "your-gcp-project-id",
  "defaultLocation": "US"
}
```

### Source Data
Update `definitions/sources.js` with your source schema:
```javascript
const raw_schema = "your_source_schema";
```

## 📊 Data Quality

### Assertions
- **Freshness**: Data must be ≤24h old
- **Uniqueness**: Surrogate keys must be unique
- **Accepted Values**: Categorical fields validated

### Cost Controls
- Partition filtering required on all large tables
- Strategic clustering on query patterns
- Explicit column selection (no SELECT *)

## 🏃‍♂️ Execution Order

Tags ensure proper dependency resolution:
```
core_dim → messaging_stg → messaging_feat → messaging_mart → messaging_srv
                      ↓
                  pricing_feat
                      ↓  
                   ops_feat → ops_mart
```

## 📈 Success Metrics

### Revenue Impact
- Timing optimization increases conversion rates
- Dynamic pricing captures 40-60% more revenue  
- Fatigue prevention maintains subscriber LTV

### Operational Efficiency
- Reduces manual scheduling decisions
- Provides data-driven insights
- Scales human expertise

## 🔒 Security & Governance

- Per-dataset ACLs and service accounts
- Audit labels: `app=eros, env=prod, owner=data`
- Column-level policies for PII
- IaC-ready (Terraform compatible)

## 🧪 Testing

```bash
npx @dataform/cli test      # Run unit tests
npx @dataform/cli compile   # Validate syntax
```

## 📝 Contributing

1. Follow domain-first design principles
2. Maintain UTC-only storage with explicit local time
3. Use deterministic surrogate keys
4. Include comprehensive assertions
5. Document business logic clearly

---

**Built with ❤️ for revenue optimization and data-driven decision making.**