/**
 * Telegram Service
 * Wrapper for Telegram Bot API interactions
 * Handles sending messages, keyboard menus, and group messages
 */

const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');

class TelegramService {
  constructor() {
    this.bot = null;
    this.initBot();
  }

  /**
   * Initialize Telegram Bot instance
   */
  initBot() {
    try {
      this.bot = new TelegramBot(config.telegram.authToken, {
        polling: false, // We'll use webhooks
      });

      console.log('[TelegramService] Bot initialized successfully');
    } catch (error) {
      console.error('[TelegramService] Bot initialization error:', error);
      throw error;
    }
  }

  /**
   * Get bot instance
   * @returns {TelegramBot} - Bot instance
   */
  getBot() {
    return this.bot;
  }

  /**
   * Send a simple text message
   * @param {string} chatId - Telegram chat ID
   * @param {string} text - Message text
   */
  async sendMessage(chatId, text) {
    try {
      await this.bot.sendMessage(chatId, text);
      console.log(`[TelegramService] Sent message to ${chatId}`);
    } catch (error) {
      console.error('[TelegramService] Error sending message:', error);
    }
  }

  /**
   * Send a message with keyboard buttons
   * @param {string} chatId - Telegram chat ID
   * @param {string} text - Message text
   * @param {array} buttons - Array of button configurations
   */
  async sendKeyboard(chatId, text, buttons) {
    try {
      // Convert buttons to Telegram keyboard format
      // Telegram uses rows and columns differently
      const keyboard = [];
      let currentRow = [];
      
      buttons.forEach((btn, index) => {
        currentRow.push({
          text: btn.text,
        });
        
        // Create new row every 2 buttons (or use columns if specified)
        const buttonsPerRow = btn.columns ? Math.floor(6 / btn.columns) : 2;
        if (currentRow.length >= buttonsPerRow || index === buttons.length - 1) {
          keyboard.push(currentRow);
          currentRow = [];
        }
      });

      const options = {
        reply_markup: {
          keyboard: keyboard,
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      };

      await this.bot.sendMessage(chatId, text, options);
      console.log(`[TelegramService] Sent keyboard to ${chatId}`);
    } catch (error) {
      console.error('[TelegramService] Error sending keyboard:', error);
    }
  }

  /**
   * Send message to a group/chat
   * @param {string} chatId - Group/Chat ID
   * @param {string} text - Message text
   */
  async sendGroupMessage(chatId, text) {
    try {
      await this.bot.sendMessage(chatId, text);
      console.log(`[TelegramService] Sent message to group ${chatId}`);
    } catch (error) {
      console.error('[TelegramService] Error sending group message:', error);
    }
  }

  /**
   * Send formatted issue notification to support group
   * @param {object} issue - Issue object
   */
  async sendIssueToSupportGroup(issue) {
    const message = this.formatIssueMessage(issue);
    
    if (config.support.groupId) {
      await this.sendGroupMessage(config.support.groupId, message);
    } else {
      console.warn('[TelegramService] Support group ID not configured');
    }
  }

  /**
   * Format issue data into a readable message
   * @param {object} issue - Issue object
   * @returns {string} - Formatted message
   */
  formatIssueMessage(issue) {
    return `
🆕 NEW HELPDESK ISSUE

📋 Issue ID: ${issue.issueId}
👤 Employee: ${issue.employeeName}
🏢 Department: ${issue.department}
🔧 Category: ${issue.category}
⚠️ Urgency: ${issue.urgency}
📞 Contact: ${issue.contactPerson}

📝 Description:
${issue.description}

Status: ${issue.status}
Created: ${new Date(issue.createdAt).toLocaleString()}

━━━━━━━━━━━━━━━━━━━
To update status, reply:
ACK ${issue.issueId}
ONGOING ${issue.issueId}
RESOLVED ${issue.issueId}
    `.trim();
  }

  /**
   * Send status update notification to employee
   * @param {string} chatId - Employee chat ID
   * @param {string} issueId - Issue ID
   * @param {string} oldStatus - Previous status
   * @param {string} newStatus - New status
   * @param {string} updatedBy - Who updated it
   */
  async notifyStatusUpdate(chatId, issueId, oldStatus, newStatus, updatedBy) {
    const statusEmoji = {
      NEW: '🆕',
      ACKNOWLEDGED: '👍',
      ONGOING: '🔧',
      RESOLVED: '✅',
    };

    const message = `
${statusEmoji[newStatus]} ISSUE STATUS UPDATE

Issue ID: ${issueId}
Status: ${oldStatus} → ${newStatus}
Updated by: ${updatedBy}

${this.getStatusMessage(newStatus)}
    `.trim();

    await this.sendMessage(chatId, message);
  }

  /**
   * Get friendly message for each status
   * @param {string} status - Issue status
   * @returns {string} - Status message
   */
  getStatusMessage(status) {
    const messages = {
      NEW: 'Your issue has been submitted and is awaiting review.',
      ACKNOWLEDGED: 'Your issue has been acknowledged by support staff.',
      ONGOING: 'Support is actively working on your issue.',
      RESOLVED: 'Your issue has been resolved. Please verify and let us know if you need further assistance.',
    };

    return messages[status] || 'Issue status updated.';
  }

  /**
   * Create department selection keyboard
   * @returns {array} - Button configuration array
   */
  getDepartmentKeyboard() {
    const { DEPARTMENTS } = require('./constants');
    return Object.values(DEPARTMENTS).map(dept => ({
      text: dept,
      value: dept,
      columns: 3,
      rows: 1,
    }));
  }

  /**
   * Create category selection keyboard
   * @returns {array} - Button configuration array
   */
  getCategoryKeyboard() {
    const { CATEGORIES } = require('./constants');
    return Object.values(CATEGORIES).map(cat => ({
      text: cat,
      value: cat,
      columns: 3,
      rows: 1,
    }));
  }

  /**
   * Create urgency selection keyboard
   * @returns {array} - Button configuration array
   */
  getUrgencyKeyboard() {
    const { URGENCY_LEVELS } = require('./constants');
    return Object.values(URGENCY_LEVELS).map((level, index) => {
      return {
        text: level,
        value: level,
        columns: 3,
        rows: 1,
      };
    });
  }

  /**
   * Create confirmation keyboard (Yes/No)
   * @returns {array} - Button configuration array
   */
  getConfirmationKeyboard() {
    return [
      { text: '✅ Yes, Submit', value: 'YES', columns: 3 },
      { text: '❌ No, Cancel', value: 'NO', columns: 3 },
    ];
  }
}

// Export singleton instance
module.exports = new TelegramService();
