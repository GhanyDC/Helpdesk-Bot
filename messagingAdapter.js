/**
 * Messaging Adapter
 * 
 * PLATFORM ABSTRACTION LAYER
 * 
 * Purpose:
 * This module provides a platform-agnostic interface for messaging operations.
 * It acts as an adapter pattern that delegates to the actual platform service
 * (Telegram, Viber, etc.) without exposing platform-specific implementation
 * details to the business logic layer.
 * 
 * Why This Exists:
 * - Decouples business logic from platform-specific APIs
 * - Makes it easy to switch platforms (Telegram → Viber) by only changing this adapter
 * - Allows messageHandler.js to remain platform-agnostic
 * - Single point of change when platform requirements change
 * 
 * Design Pattern: Adapter Pattern
 * - Business logic calls generic methods (sendMessage, sendKeyboard)
 * - Adapter translates to platform-specific calls
 * - Platform service handles actual API communication
 * 
 * Future Migration Path:
 * To switch from Telegram to Viber:
 *   1. Change platformService to require viberService
 *   2. Update initialization logic if needed
 *   3. All business logic continues working unchanged
 * 
 * Author: Tech Solutions Inc.
 * Date: January 2026
 */

// Import the platform service (Telegram for now, Viber in future)
const platformService = require('./telegramService');
const logger = require('./logger');

class MessagingAdapter {
  constructor() {
    this.platformService = platformService;
    logger.info('[MessagingAdapter] Initialized with Telegram platform');
  }

  /**
   * Get the underlying platform service instance
   * Used when platform-specific features are absolutely needed
   * @returns {object} - Platform service instance
   */
  getPlatformService() {
    return this.platformService;
  }

  /**
   * Send a simple text message to a user
   * @param {string} chatId - User/chat identifier
   * @param {string} text - Message text
   */
  async sendMessage(chatId, text) {
    return await this.platformService.sendMessage(chatId, text);
  }

  /**
   * Send a message with keyboard buttons to a user
   * @param {string} chatId - User/chat identifier
   * @param {string} text - Message text
   * @param {array} buttons - Button configurations (platform-agnostic format)
   */
  async sendKeyboard(chatId, text, buttons) {
    return await this.platformService.sendKeyboard(chatId, text, buttons);
  }

  /**
   * Send a message to a group/channel
   * @param {string} groupId - Group/channel identifier
   * @param {string} text - Message text
   */
  async sendGroupMessage(groupId, text) {
    return await this.platformService.sendGroupMessage(groupId, text);
  }

  /**
   * Get department selection keyboard
   * @returns {array} - Button configuration array
   */
  getDepartmentKeyboard() {
    return this.platformService.getDepartmentKeyboard();
  }

  /**
   * Get category selection keyboard
   * @returns {array} - Button configuration array
   */
  getCategoryKeyboard() {
    return this.platformService.getCategoryKeyboard();
  }

  /**
   * Get urgency level selection keyboard
   * @returns {array} - Button configuration array
   */
  getUrgencyKeyboard() {
    return this.platformService.getUrgencyKeyboard();
  }

  /**
   * Get confirmation keyboard (Yes/No)
   * @returns {array} - Button configuration array
   */
  getConfirmationKeyboard() {
    return this.platformService.getConfirmationKeyboard();
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
    return await this.platformService.notifyStatusUpdate(
      chatId,
      issueId,
      oldStatus,
      newStatus,
      updatedBy
    );
  }

  /**
   * Format issue data into a readable message
   * @param {object} issue - Issue object
   * @returns {string} - Formatted message
   */
  formatIssueMessage(issue) {
    return this.platformService.formatIssueMessage(issue);
  }

  /**
   * Send a message with inline keyboard buttons (callback buttons)
   * @param {string} chatId - Chat/user ID
   * @param {string} text - Message text
   * @param {array} inlineKeyboard - Array of rows of inline buttons
   * @returns {object} - Sent message object
   */
  async sendInlineKeyboard(chatId, text, inlineKeyboard) {
    return await this.platformService.sendInlineKeyboard(chatId, text, inlineKeyboard);
  }

  /**
   * Answer a callback query (inline button press acknowledgment)
   * @param {string} callbackQueryId - Callback query ID
   * @param {string} text - Toast/alert text
   * @param {boolean} showAlert - Show modal alert vs toast
   */
  async answerCallbackQuery(callbackQueryId, text, showAlert = false) {
    return await this.platformService.answerCallbackQuery(callbackQueryId, text, showAlert);
  }

  /**
   * Edit an existing message's text and/or inline keyboard
   * @param {string} chatId - Chat ID
   * @param {number} messageId - Message ID to edit
   * @param {string} text - New message text
   * @param {array|null} inlineKeyboard - New inline keyboard or null to remove
   */
  async editMessageText(chatId, messageId, text, inlineKeyboard = null) {
    return await this.platformService.editMessageText(chatId, messageId, text, inlineKeyboard);
  }

  /**
   * Delete a message from a chat
   * @param {string} chatId - Chat ID
   * @param {number} messageId - Message ID to delete
   */
  async deleteMessage(chatId, messageId) {
    return await this.platformService.deleteMessage(chatId, messageId);
  }

  /**
   * Set chat permissions for a group
   * @param {string} chatId - Group chat ID
   * @param {object} permissions - Chat permissions object
   */
  async setChatPermissions(chatId, permissions) {
    return await this.platformService.setChatPermissions(chatId, permissions);
  }
}

// Export singleton instance
module.exports = new MessagingAdapter();
