/**
 * Configuration Module
 * Loads environment variables and exports configuration settings
 */

require('dotenv').config();

module.exports = {
  // Telegram Bot Credentials
  telegram: {
    authToken: process.env.TELEGRAM_BOT_TOKEN,
    botName: process.env.BOT_NAME || 'Helpdesk Bot',
  },

  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    webhookUrl: process.env.WEBHOOK_URL,
  },

  // Support Group Configuration
  support: {
    // Legacy single group (backward compatibility)
    groupId: process.env.SUPPORT_GROUP_ID,

    // BRANCH-BASED SUPPORT GROUPS (CORRECT MODEL)
    // Each BRANCH (not department) has its own support group
    // Branch = Physical location / company (JHQ, TRK, GS, IPIL)
    // Each group contains: support staff + all dept reps for that branch
    // Routing logic: issue.branch → corresponding support group
    branchGroups: {
      'JHQ': process.env.SUPPORT_GROUP_JHQ,
      'TRK': process.env.SUPPORT_GROUP_TRK,
      'GS': process.env.SUPPORT_GROUP_GS,
      'IPIL': process.env.SUPPORT_GROUP_IPIL,
    },

    // Central monitoring group (management oversight - read-only visibility)
    // This group receives copies of ALL issues across all branches
    // Purpose: Executive visibility, trend analysis, resource allocation
    // Cannot update status (visibility only)
    centralMonitoringGroup: process.env.CENTRAL_MONITORING_GROUP,

    // Feature flag: Enable/disable central monitoring
    enableCentralMonitoring: process.env.ENABLE_CENTRAL_MONITORING === 'true',
  },

  // Database Configuration
  database: {
    path: process.env.DB_PATH || './data/helpdesk.db',
  },

  // Authorization Lists
  auth: {
    supportStaffIds: process.env.SUPPORT_STAFF_IDS 
      ? process.env.SUPPORT_STAFF_IDS.split(',').map(id => id.trim())
      : [],
    employeeIds: process.env.EMPLOYEE_IDS 
      ? process.env.EMPLOYEE_IDS.split(',').map(id => id.trim())
      : [], // Empty means all allowed
  },
};
