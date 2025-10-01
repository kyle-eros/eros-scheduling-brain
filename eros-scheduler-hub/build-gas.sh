#!/bin/bash

# Clean dist
rm -rf dist
mkdir -p dist/ui

# Copy UI files
cp -R src/ui/* dist/ui/

# Copy appsscript.json
cat > dist/appsscript.json << 'EOF'
{
  "timeZone": "America/Denver",
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "dependencies": {
    "enabledAdvancedServices": [
      { "userSymbol": "BigQuery", "serviceId": "bigquery", "version": "v2" }
    ]
  },
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.container.ui",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/bigquery",
    "https://www.googleapis.com/auth/script.external_request"
  ]
}
EOF

# Concatenate TypeScript files in the right order, removing imports/exports
cat > dist/Code.js << 'EOF'
// EROS Scheduler Hub v2 - Google Apps Script
// Combined source file for Apps Script environment

// CONFIG
const CONFIG = {
  projectId: 'of-scheduler-proj',
  timezone: 'America/Denver',
  cache: {
    enabled: true,
    ttlSeconds: 15 * 60
  },
  sheets: {
    controlHub: 'Control Hub',
    todayPlanner: 'Today Planner',
    weekPlanner: 'Week Planner',
    alerts: 'Risk Console',
    captions: 'Caption Studio',
    performance: 'Performance Pulse',
    logs: 'Action Log',
    diagnostics: 'Diagnostics',
    settings: 'Settings'
  },
  datasets: {
    mart: 'eros_messaging_mart',
    feat: 'eros_messaging_feat',
    srv: 'eros_messaging_srv',
    source: 'eros_source',
    ops: 'eros_ops'
  },
  tables: {
    enhancedDaily: 'enhanced_daily_recommendations',
    caption24h: 'caption_rank_next24_v3_tbl',
    captionByType: 'caption_rank_next24_by_type',
    schedulerDashboard: 'scheduler_dashboard',
    tierAssignments: 'scheduler_assignments',
    roster: 'scheduler_roster',
    authenticity: 'authenticity_monitor',
    tierTemplates: 'tier_baseline_templates',
    sendLog: 'send_log'
  }
};

EOF

# Compile TypeScript and append, stripping imports
npx tsc --target ES2019 --module none --removeComments --outDir temp_out src/**/*.ts 2>/dev/null || true

# Manually concatenate the core functions from source
for file in src/services/*.ts src/sheets/*.ts src/main.ts; do
  echo "// From $file" >> dist/Code.js
  # Remove import/export statements and TypeScript type definitions
  sed -E '
    /^import /d
    /^export /d
    /^type /d
    /^interface /d
    s/export class/class/g
    s/export interface/interface/g
    s/export const/const/g
    s/export function/function/g
    s/: any\[\]/[]/g
    s/: any//g
    s/: string//g
    s/: number//g
    s/: boolean//g
    s/: void//g
    s/: Date//g
    s/: Map<[^>]*>//g
    s/: Set<[^>]*>//g
    s/: TodayRow\[\]/[]/g
    s/: TodayRow//g
    s/: HomeTile\[\]/[]/g
    s/: WeekRow\[\]/[]/g
    s/: WeekRow//g
    s/: AuthenticityAlert\[\]/[]/g
    s/: CaptionSuggestion\[\]/[]/g
    s/: PerformanceMetric\[\]/[]/g
    s/: SchedulerIdentity//g
    s/: PreflightIssue\[\]/[]/g
    s/: PreflightIssue//g
    s/: ActionPayload\[\]/[]/g
    s/: PriceViolation\[\]/[]/g
    s/: GoogleAppsScript[^,\)]*//g
    s/: QueryParameter\[\]//g
    s/: QueryParameter//g
    s/: QueryRequest//g
    s/: QueryResponse//g
    s/: BigQueryService//g
    s/: DataService//g
    s/: LoggingService//g
    s/: OverrideService//g
    s/: \{[^}]*\}//g
    s/\<[^>]*\>//g
  ' "$file" >> dist/Code.js
done

echo "Build complete - dist/Code.js created"