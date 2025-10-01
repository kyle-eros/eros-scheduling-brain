"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG = void 0;
exports.CONFIG = {
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
