/**
 * Viber Service
 * Wrapper for Viber Bot API interactions
 * Handles sending messages, keyboard menus, and group messages
 */

const ViberBot = require('viber-bot').Bot;
const BotEvents = require('viber-bot').Events;
const TextMessage = require('viber-bot').Message.Text;
const KeyboardMessage = require('viber-bot').Message.Keyboard;
const config = require('./config');

class ViberService {
  constructor() {
    this.bot = null;
    this.initBot();
  }

  /**
   * Initialize Viber Bot instance
   */
  initBot() {
    try {
      this.bot = new ViberBot({
        authToken: config.viber.authToken,
        name: config.viber.botName,
        avatar: config.viber.botAvatar,
      });

      console.log('[ViberService] Bot initialized successfully');
    } catch (error) {
      console.error('[ViberService] Bot initialization error:', error);
      throw error;
    }
  }

  /**
   * Get bot instance
   * @returns {ViberBot} - Bot instance
   */
  getBot() {
    return this.bot;
  }

  /**
   * Send a simple text message
   * @param {string} userId - Viber user ID
   * @param {string} text - Message text
   */
  async sendMessage(userId, text) {
    try {
      await this.bot.sendMessage({ id: userId }, new TextMessage(text));
      console.log(`[ViberService] Sent message to ${userId}`);
    } catch (error) {
      console.error('[ViberService] Error sending message:', error);
    }
  }

  /**
   * Send a message with keyboard buttons
   * @param {string} userId - Viber user ID
   * @param {string} text - Message text
   * @param {array} buttons - Array of button configurations
   */
  async sendKeyboard(userId, text, buttons) {
    try {
      const keyboard = {
        Type: 'keyboard',
        Buttons: buttons.map(btn => ({
          Columns: btn.columns || 3,
          Rows: btn.rows || 1,
          BgColor: btn.bgColor || '#f7f7f7',
          Text: btn.text,
          TextSize: btn.textSize || 'regular',
          ActionType: 'reply',
          ActionBody: btn.value || btn.text,
        })),
      };

      await this.bot.sendMessage(
        { id: userId },
        new KeyboardMessage(keyboard, null, text)
      );

      console.log(`[ViberService] Sent keyboard to ${userId}`);
    } catch (error) {
      console.error('[ViberService] Error sending keyboard:', error);
    }
  }

  /**
   * Send message to a group/chat
   * @param {string} groupId - Group/Chat ID
   * @param {string} text - Message text
   */
  async sendGroupMessage(groupId, text) {
    try {
      await this.bot.sendMessage({ id: groupId }, new TextMessage(text));
      console.log(`[ViberService] Sent message to group ${groupId}`);
    } catch (error) {
      console.error('[ViberService] Error sending group message:', error);
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
      console.warn('[ViberService] Support group ID not configured');
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
   * @param {string} employeeId - Employee Viber ID
   * @param {string} issueId - Issue ID
   * @param {string} oldStatus - Previous status
   * @param {string} newStatus - New status
   * @param {string} updatedBy - Who updated it
   */
  async notifyStatusUpdate(employeeId, issueId, oldStatus, newStatus, updatedBy) {
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

    await this.sendMessage(employeeId, message);
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
      const colors = ['#90EE90', '#FFD700', '#FFA500', '#FF6347'];
      return {
        text: level,
        value: level,
        columns: 3,
        rows: 1,
        bgColor: colors[index],
      };
    });
  }

  /**
   * Create confirmation keyboard (Yes/No)
   * @returns {array} - Button configuration array
   */
  getConfirmationKeyboard() {
    return [
      { text: '✅ Yes, Submit', value: 'YES', columns: 3, bgColor: '#4CAF50' },
      { text: '❌ No, Cancel', value: 'NO', columns: 3, bgColor: '#f44336' },
    ];
  }
}

// Export singleton instance
module.exports = new ViberService();
