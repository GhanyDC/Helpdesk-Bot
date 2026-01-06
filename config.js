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
    groupId: process.env.SUPPORT_GROUP_ID,
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
