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
      'pending': '⏳',
      'in-process': '🔧',
      'resolved': '✅',
      'resolved-with-issues': '⚠️',
      'confirmed': '✅',
      'cancelled-staff': '❌',
      'cancelled-user': '❌',
    };

    const emoji = statusEmoji[newStatus] || '📋';

    const message = `
${emoji} ISSUE STATUS UPDATE

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
      'pending': 'Your issue is awaiting review.',
      'in-process': 'Support is actively working on your issue.',
      'resolved': 'Your issue has been marked as resolved.',
      'resolved-with-issues': 'Your issue has been resolved with some remaining issues noted.',
      'confirmed': 'Your issue has been confirmed as resolved.',
      'cancelled-staff': 'Your issue has been cancelled by support staff.',
      'cancelled-user': 'Your issue has been cancelled.',
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

  /**
   * Send a message with inline keyboard buttons (callback buttons)
   * Unlike reply keyboards, inline keyboards are attached to the message itself
   * @param {string} chatId - Chat ID
   * @param {string} text - Message text
   * @param {array} inlineKeyboard - Array of rows, each row is array of {text, callback_data}
   * @returns {object} - Sent message object (includes message_id)
   */
  async sendInlineKeyboard(chatId, text, inlineKeyboard) {
    try {
      const options = {
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      };
      const sentMessage = await this.bot.sendMessage(chatId, text, options);
      console.log(`[TelegramService] Sent inline keyboard to ${chatId}`);
      return sentMessage;
    } catch (error) {
      console.error('[TelegramService] Error sending inline keyboard:', error);
    }
  }

  /**
   * Answer a callback query (acknowledges inline button press)
   * @param {string} callbackQueryId - Callback query ID
   * @param {string} text - Toast/alert text to show
   * @param {boolean} showAlert - If true, shows modal alert instead of toast
   */
  async answerCallbackQuery(callbackQueryId, text, showAlert = false) {
    try {
      await this.bot.answerCallbackQuery(callbackQueryId, { text, show_alert: showAlert });
    } catch (error) {
      console.error('[TelegramService] Error answering callback query:', error);
    }
  }

  /**
   * Edit an existing message's text and/or inline keyboard
   * Used to update ticket messages after status changes
   * @param {string} chatId - Chat ID
   * @param {number} messageId - Message ID to edit
   * @param {string} text - New message text
   * @param {array|null} inlineKeyboard - New inline keyboard (null to remove buttons)
   */
  async editMessageText(chatId, messageId, text, inlineKeyboard = null) {
    try {
      const options = {
        chat_id: chatId,
        message_id: messageId,
      };
      if (inlineKeyboard) {
        options.reply_markup = { inline_keyboard: inlineKeyboard };
      } else {
        options.reply_markup = { inline_keyboard: [] };
      }
      await this.bot.editMessageText(text, options);
      console.log(`[TelegramService] Edited message ${messageId} in ${chatId}`);
    } catch (error) {
      console.error('[TelegramService] Error editing message:', error);
    }
  }

  /**
   * Delete a message from a chat
   * @param {string} chatId - Chat ID
   * @param {number} messageId - Message ID to delete
   */
  async deleteMessage(chatId, messageId) {
    try {
      await this.bot.deleteMessage(chatId, messageId);
      console.log(`[TelegramService] Deleted message ${messageId} in ${chatId}`);
    } catch (error) {
      console.error('[TelegramService] Error deleting message:', error);
    }
  }

  /**
   * Set chat permissions for a group (restrict members from sending messages)
   * Used to lock down central monitoring group so only bot can post
   * @param {string} chatId - Group chat ID
   * @param {object} permissions - Chat permissions object
   */
  async setChatPermissions(chatId, permissions) {
    try {
      await this.bot.setChatPermissions(chatId, permissions);
      console.log(`[TelegramService] Set chat permissions for ${chatId}`);
    } catch (error) {
      console.error('[TelegramService] Error setting chat permissions:', error);
    }
  }
}

// Export singleton instance
module.exports = new TelegramService();
