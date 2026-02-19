/**
 * Configuration Module
 * Loads and validates environment variables.
 * Refuses to start if critical config is missing.
 */

require('dotenv').config();
const crypto = require('crypto');

// ── Validate critical env vars ────────────────────────────────────
const REQUIRED = [
  'TELEGRAM_BOT_TOKEN',
  'WEBHOOK_URL',
  'DB_HOST',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
];

const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error('FATAL: Missing required environment variables: ' + missing.join(', '));
  process.exit(1);
}

// ── Webhook secret path ───────────────────────────────────────────
// If WEBHOOK_SECRET is set, use it; otherwise generate a random one.
const webhookSecret =
  process.env.WEBHOOK_SECRET || crypto.randomBytes(24).toString('hex');

module.exports = {
  telegram: {
    authToken: process.env.TELEGRAM_BOT_TOKEN,
    botName: process.env.BOT_NAME || 'Helpdesk Bot',
  },

  server: {
    port: process.env.PORT || 3000,
    webhookUrl: process.env.WEBHOOK_URL,
    webhookSecret,
  },

  support: {
    groupId: process.env.SUPPORT_GROUP_ID,
    branchGroups: {
      JHQ: process.env.SUPPORT_GROUP_JHQ,
      TRK: process.env.SUPPORT_GROUP_TRK,
      GS: process.env.SUPPORT_GROUP_GS,
      IPIL: process.env.SUPPORT_GROUP_IPIL,
    },
    centralMonitoringGroup: process.env.CENTRAL_MONITORING_GROUP,
    enableCentralMonitoring: process.env.ENABLE_CENTRAL_MONITORING === 'true',
  },

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'helpdesk',
    user: process.env.DB_USER || 'helpdesk',
    password: process.env.DB_PASSWORD || 'helpdesk',
  },

  auth: {
    supportStaffIds: process.env.SUPPORT_STAFF_IDS
      ? process.env.SUPPORT_STAFF_IDS.split(',').map((id) => id.trim())
      : [],
    employeeIds: process.env.EMPLOYEE_IDS
      ? process.env.EMPLOYEE_IDS.split(',').map((id) => id.trim())
      : [],
  },
};
