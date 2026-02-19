/**
 * Message Handler
 * Routes incoming messages and processes user input
 * Handles conversation flow and support staff commands
 * 
 * PLATFORM-AGNOSTIC BUSINESS LOGIC
 * Uses messagingAdapter instead of direct platform calls
 * This allows switching from Telegram to Viber without changing this file
 */

const conversationManager = require('./conversationManager');
const logger = require('./logger');
const issueManager = require('./issueManager');
const messagingAdapter = require('./messagingAdapter'); // Platform abstraction
const routingService = require('./routingService');     // Branch routing
const permissionsManager = require('./permissionsManager');
const statsService = require('./statsService');         // Statistics & metrics
const userIdLogger = require('./userIdLogger');         // User ID discovery
const { CONVERSATION_STEPS, SUPPORT_KEYWORDS, ISSUE_STATUS, STATUS_LABELS, TERMINAL_STATUSES, STATUS_CODES, BRANCHES, DEPARTMENTS } = require('./constants');

class MessageHandler {
  constructor() {
    // Tracks pending remarks from support staff
    // Key: `${chatId}_${userId}`, Value: Array of { issueId, statusCode, messageId, timestamp }
    // Queue-based: supports multiple resolve clicks before typing remarks
    this.pendingRemarks = new Map();

    // Cleanup stale pending remarks every 10 minutes
    setInterval(() => this.cleanupPendingRemarks(), 10 * 60 * 1000);
  }

  /**
   * Handle incoming text message
   * @param {object} message - Telegram message object
   * @param {object} userProfile - User profile information
   */
  async handleMessage(message, userProfile) {
    const userId = userProfile.id;
    const chatId = userProfile.chatId;
    const userName = userProfile.name || 'User';
    const messageText = message.text.trim();
    const isGroupChat = userProfile.isGroup || false;

    logger.info(`[MessageHandler] Received message from ${userName} (${userId}) in ${isGroupChat ? 'GROUP' : 'PRIVATE'}: ${messageText}`);

    // ── CENTRAL MONITORING: Delete non-bot messages ──
    const config = require('./config');
    if (isGroupChat && config.support.centralMonitoringGroup &&
        chatId.toString() === config.support.centralMonitoringGroup.toString()) {
      try {
        await messagingAdapter.deleteMessage(chatId, message.message_id);
      } catch (e) { /* bot may not have delete perms yet */ }
      return;
    }

    // ── SUPPORT GROUP: Check for pending remarks ──
    if (isGroupChat && !messageText.startsWith('/')) {
      const remarksKey = `${chatId}_${userId}`;
      const queue = this.pendingRemarks.get(remarksKey);
      if (queue && queue.length > 0) {
        await this.processRemarks(remarksKey, messageText, userId, chatId, userName);
        return;
      }
    }

    // Handle /cancel_remarks command in groups
    if (isGroupChat && messageText.toLowerCase() === '/cancel_remarks') {
      const remarksKey = `${chatId}_${userId}`;
      const queue = this.pendingRemarks.get(remarksKey);
      if (queue && queue.length > 0) {
        const cancelled = queue.shift();
        if (queue.length === 0) this.pendingRemarks.delete(remarksKey);
        await messagingAdapter.sendMessage(chatId, `❌ Remarks for ${cancelled.issueId} cancelled. Status was not updated.`);
        // Prompt for next in queue
        if (queue.length > 0) {
          const next = queue[0];
          const nextIssue = await issueManager.getIssue(next.issueId);
          const description = nextIssue ? nextIssue.description : 'N/A';
          await messagingAdapter.sendMessage(chatId, `📝 REMARKS REQUIRED\n\n📋 Issue: ${next.issueId}\n\n📄 Subject:\n${description}\n\nPlease REPLY to this message with your remarks for this ticket.\n\n⚠️ Important: Use the REPLY function to respond to this message.\n\n💡 Type /cancel_remarks to skip`);
        }
      }
      return;
    }

    // Check if this is a support command (/status) - MUST CHECK BEFORE OTHER COMMANDS
    if (this.isSupportCommand(messageText)) {
      if (!isGroupChat) {
        await messagingAdapter.sendMessage(chatId, '❌ Status updates can only be done in the support group.\n\nTo create a ticket, just send me a regular message.');
        return;
      }
      await this.handleSupportCommand(messageText, userId, chatId, userName, message);
      return;
    }

    // Check if this is a bot command (/stats, /open_issues, etc.)
    if (messageText.startsWith('/')) {
      await this.handleBotCommand(messageText, userId, chatId, userName, isGroupChat);
      return;
    }

    // Ticket creation only allowed in PRIVATE CHATS
    if (isGroupChat) {
      // Notify user that tickets can't be created in groups
      await messagingAdapter.sendMessage(chatId, '⛔ Ticket creation is not available in groups.\n\nPlease message the bot directly to submit a new helpdesk ticket.');
      return;
    }

    // Check if user can create issues
    const authCheck = permissionsManager.checkAuthorization(userId, 'create');
    if (!authCheck.authorized) {
      await messagingAdapter.sendMessage(chatId, `⛔ ACCESS DENIED\n\n${authCheck.message}`);
      return;
    }

    // Check if user has active conversation
    const conversation = await conversationManager.getConversation(userId);

    if (!conversation) {
      // Start new conversation
      await this.startNewIssue(userId, chatId, userProfile);
    } else {
      // Continue existing conversation
      await this.processConversationStep(userId, chatId, conversation, messageText, userProfile);
    }
  }

  /**
   * Check if message is a support command
   * @param {string} text - Message text
   * @returns {boolean}
   */
  isSupportCommand(text) {
    const lowerText = text.toLowerCase().trim();
    return lowerText.startsWith('/status');
  }

  /**
   * Handle bot commands (/stats, /open_issues, etc.)
   * 
   * Available commands:
   * - /stats - Today's overall statistics
   * - /stats <department> - Department-specific stats
   * - /open_issues - All open issues by department
   * 
   * @param {string} text - Command text
   * @param {string} userId - User ID
   * @param {string} chatId - Chat ID
   * @param {string} userName - User name
   * @param {boolean} isGroupChat - Whether message is from a group
   */
  async handleBotCommand(text, userId, chatId, userName, isGroupChat = false) {
    const parts = text.trim().split(/\s+/);
    const command = parts[0].toLowerCase();

    logger.info(`[MessageHandler] Bot command received: ${command}`);

    switch (command) {
      case '/stats':
        await this.handleStatsCommand(parts, chatId);
        break;

      case '/open_issues':
      case '/open':
        await this.handleOpenIssuesCommand(chatId);
        break;

      case '/whoami':
        await this.handleWhoAmICommand(userId, chatId);
        break;

      case '/list_users':
        await this.handleListUsersCommand(userId, chatId);
        break;

      case '/help':
        await this.handleHelpCommand(chatId);
        break;

      default:
        // Unknown command - ignore or show help
        await messagingAdapter.sendMessage(
          chatId,
          '❓ Unknown command. Send /help for available commands.'
        );
    }
  }

  /**
   * Handle /stats command
   * Supports: /stats (overall), /stats <branch>, /stats <department>
   * @param {array} parts - Command parts
   * @param {string} chatId - Chat ID
   */
  async handleStatsCommand(parts, chatId) {
    if (parts.length === 1) {
      // /stats - show overall today's stats
      const message = await statsService.formatTodayStatsMessage();
      await messagingAdapter.sendMessage(chatId, message);
    } else {
      const input = parts.slice(1).join(' ');

      // Try to match branch first (case-insensitive)
      const matchedBranch = Object.values(BRANCHES).find(
        branch => branch.toLowerCase() === input.toLowerCase()
      );

      if (matchedBranch) {
        const message = await statsService.formatBranchStatsMessage(matchedBranch);
        await messagingAdapter.sendMessage(chatId, message);
        return;
      }
      
      // Try to match department (case-insensitive)
      const matchedDept = Object.values(DEPARTMENTS).find(
        dept => dept.toLowerCase() === input.toLowerCase()
      );

      if (matchedDept) {
        const message = await statsService.formatDepartmentStatsMessage(matchedDept);
        await messagingAdapter.sendMessage(chatId, message);
      } else {
        await messagingAdapter.sendMessage(
          chatId,
          `❌ Unknown branch or department: "${input}"\n\nBranches: ${Object.values(BRANCHES).join(', ')}\nDepartments: ${Object.values(DEPARTMENTS).join(', ')}`
        );
      }
    }
  }

  /**
   * Handle /open_issues command
   * @param {string} chatId - Chat ID
   */
  async handleOpenIssuesCommand(chatId) {
    const message = await statsService.formatOpenIssuesMessage();
    await messagingAdapter.sendMessage(chatId, message);
  }

  /**
   * Handle /help command
   * @param {string} chatId - Chat ID
   */
  async handleHelpCommand(chatId) {
    const helpMessage = `📋 HELPDESK COMMAND GUIDE

📊 Reports & Statistics
/stats — Today's overall statistics
/stats JHQ — Branch-specific stats
/stats Sales — Department-specific stats
/open_issues — All open issues by branch

👤 Account
/whoami — View your user ID & role
/list_users — All registered users (Staff)

🔧 Support Staff — Status Updates
• Click inline buttons on ticket messages
• Or reply /status to any ticket message
• Remarks are required when resolving

📝 Create a Ticket
Send any message directly to this bot in a private chat to start a new ticket.`;

    await messagingAdapter.sendMessage(chatId, helpMessage);
  }

  /**
   * Handle /whoami command
   * Shows user their own ID and permissions
   * @param {string} userId - User ID
   * @param {string} chatId - Chat ID
   */
  async handleWhoAmICommand(userId, chatId) {
    const message = await userIdLogger.formatUserInfo(userId);
    await messagingAdapter.sendMessage(chatId, message);
  }

  /**
   * Handle /list_users command
   * Shows all registered users (Support Staff only)
   * @param {string} userId - User ID
   * @param {string} chatId - Chat ID
   */
  async handleListUsersCommand(userId, chatId) {
    // Check if user is support staff
    if (!permissionsManager.isSupportStaff(userId)) {
      await messagingAdapter.sendMessage(
        chatId,
        '❌ This command is only available to support staff.\n\nUse /whoami to see your own information.'
      );
      return;
    }

    const message = await userIdLogger.formatUserList();
    await messagingAdapter.sendMessage(chatId, message);
  }

  /**
   * Handle support staff commands (/status)
   * 
   * Supports two modes:
   * 1. REPLY-BASED (new): Reply /status to a ticket message → shows inline buttons
   * 2. LEGACY: /status ISSUE-ID STATUS (backward compatible)
   * 
   * @param {string} text - Command text
   * @param {string} userId - User ID
   * @param {string} chatId - Chat ID
   * @param {string} userName - User name
   * @param {object} message - Original Telegram message object (for reply detection)
   */
  async handleSupportCommand(text, userId, chatId, userName, message) {
    // Check if user is support staff
    const authCheck = permissionsManager.checkAuthorization(userId, 'update');
    if (!authCheck.authorized) {
      await messagingAdapter.sendMessage(chatId, authCheck.message);
      return;
    }

    // MODE 1: Reply-based /status (streamlined approach)
    if (message && message.reply_to_message) {
      const repliedText = message.reply_to_message.text || '';

      // Extract issue ID from the replied message
      const issueIdMatch = repliedText.match(/ISSUE-\d{8}-\d{4}/);

      if (!issueIdMatch) {
        await messagingAdapter.sendMessage(
          chatId,
          '❌ Could not find a ticket ID in the message you replied to.\n\nPlease reply /status to a ticket message.'
        );
        return;
      }

      const issueId = issueIdMatch[0];
      const issue = await issueManager.getIssue(issueId);

      if (!issue) {
        await messagingAdapter.sendMessage(chatId, `❌ Issue not found: ${issueId}`);
        return;
      }

      // Check if issue is in terminal state
      if (TERMINAL_STATUSES.includes(issue.status)) {
        const label = STATUS_LABELS[issue.status] || issue.status;
        await messagingAdapter.sendMessage(chatId, `ℹ️ Issue ${issueId} is already ${label}.\nNo further updates allowed.`);
        return;
      }

      // Send inline buttons for status update
      const buttons = this.getStatusButtons(issueId, issue.status);
      const statusLabel = STATUS_LABELS[issue.status] || issue.status;

      await messagingAdapter.sendInlineKeyboard(
        chatId,
        `📋 UPDATE STATUS

📋 Issue: ${issueId}
📊 Current Status: ${statusLabel}

Select new status below:`,
        buttons
      );
      return;
    }

    // MODE 2: Legacy format /status ISSUE-ID STATUS
    const parts = text.trim().split(/\s+/);

    if (parts.length === 1) {
      // Just "/status" without replying to a message
      await messagingAdapter.sendMessage(
        chatId,
        '💡 HOW TO UPDATE STATUS\n\n1️⃣ Reply to any ticket message with /status\n2️⃣ Click the desired status button\n3️⃣ Type your remarks when prompted\n\nOr use the inline buttons directly on the ticket message.'
      );
      return;
    }

    if (parts.length >= 3) {
      const issueId = parts[1];
      const statusInput = parts[2].toLowerCase();
      const validStatuses = Object.values(ISSUE_STATUS);

      if (!validStatuses.includes(statusInput)) {
        await messagingAdapter.sendMessage(
          chatId,
          `❌ Invalid status.\n\nValid statuses: ${validStatuses.join(', ')}`
        );
        return;
      }

      const issue = await issueManager.getIssue(issueId);
      if (!issue) {
        await messagingAdapter.sendMessage(chatId, `❌ Issue not found: ${issueId}`);
        return;
      }

      if (TERMINAL_STATUSES.includes(issue.status)) {
        const label = STATUS_LABELS[issue.status] || issue.status;
        await messagingAdapter.sendMessage(chatId, `ℹ️ Issue ${issueId} is already ${label}.\nNo further updates allowed.`);
        return;
      }

      // Check ticket ownership: if assigned, only the assigned staff can update
      if (issue.assigned_to && issue.assigned_to !== userId) {
        await messagingAdapter.sendMessage(
          chatId,
          `❌ This ticket is assigned to ${issue.assigned_to_name || 'another staff member'}. Only they can update it.`
        );
        return;
      }

      const oldStatus = issue.status;

      // For resolve statuses, require remarks as additional text
      if (statusInput === ISSUE_STATUS.RESOLVED || statusInput === ISSUE_STATUS.RESOLVED_WITH_ISSUES) {
        const remarksText = parts.slice(3).join(' ').trim();
        if (!remarksText) {
          await messagingAdapter.sendMessage(chatId, `📝 Remarks required when resolving a ticket.\n\nUsage:\n/status ${issueId} ${statusInput} <your remarks>\n\nOr use the inline buttons on the ticket message for a guided flow.`);
          return;
        }

        const success = await issueManager.resolveWithRemarks(issueId, statusInput, remarksText, userId, userName);
        if (success) {
          const statusLabel = STATUS_LABELS[statusInput] || statusInput;
          await messagingAdapter.sendMessage(chatId, `✅ Updated ${issueId}\nStatus: ${oldStatus} → ${statusLabel}\n\n📝 Remarks:\n${remarksText}`);
          await routingService.notifyStatusUpdate(issue, oldStatus, statusInput, userName, remarksText);
          await this.sendConfirmationRequest(issue, statusInput, userName, remarksText);
          logger.info(`[MessageHandler] Status updated: ${issueId} ${oldStatus} → ${statusInput} by ${userName}`);
        } else {
          await messagingAdapter.sendMessage(chatId, '❌ Failed to update issue status.');
        }
        return;
      }

      const success = await issueManager.updateIssueStatus(issueId, statusInput, userId, userName);

      if (success) {
        const statusLabel = STATUS_LABELS[statusInput] || statusInput;
        await messagingAdapter.sendMessage(chatId, `✅ Updated ${issueId}\nStatus: ${oldStatus} → ${statusLabel}`);
        await routingService.notifyStatusUpdate(issue, oldStatus, statusInput, userName);

        logger.info(`[MessageHandler] Status updated: ${issueId} ${oldStatus} → ${statusInput} by ${userName}`);
      } else {
        await messagingAdapter.sendMessage(chatId, '❌ Failed to update issue status.');
      }
    } else {
      await messagingAdapter.sendMessage(
        chatId,
        '❌ Invalid command format.\n\nUsage:\n• Reply /status to a ticket message\n• /status ISSUE-ID STATUS\n\nTip: Use the inline buttons on ticket messages for the easiest experience.'
      );
    }
  }

  /**
   * Handle Telegram callback queries (inline button presses)
   * Routes to appropriate handler based on callback data prefix
   * 
   * Callback data format:
   * - st:ISSUE-ID:STATUS_CODE  → Status update by support staff
   * - cf:ISSUE-ID:yes/no       → Confirmation by employee
   * - cancel:ISSUE-ID          → Cancel by employee
   */
  async handleCallbackQuery(callbackData) {
    const { callbackQueryId, userId, userName, chatId, messageId, data } = callbackData;
    logger.info(`[MessageHandler] Callback query from ${userName} (${userId}): ${data}`);

    const parts = data.split(':');
    const action = parts[0];

    switch (action) {
      case 'st':
        await this.handleStatusCallback(callbackQueryId, userId, userName, chatId, messageId, parts);
        break;
      case 'cf':
        await this.handleConfirmCallback(callbackQueryId, userId, userName, chatId, messageId, parts);
        break;
      case 'cancel':
        await this.handleCancelCallback(callbackQueryId, userId, userName, chatId, messageId, parts);
        break;
      default:
        await messagingAdapter.answerCallbackQuery(callbackQueryId, '❌ Unknown action');
    }
  }

  /**
   * Handle status update callback from support staff inline button
   * For resolve/resolve-with-issues: stores pending state and asks for remarks
   * For other statuses: updates immediately
   */
  async handleStatusCallback(callbackQueryId, userId, userName, chatId, messageId, parts) {
    if (parts.length < 3) {
      await messagingAdapter.answerCallbackQuery(callbackQueryId, '❌ Invalid callback data');
      return;
    }

    const issueId = parts[1];
    const statusCode = parts[2];

    // Check permissions
    const authCheck = permissionsManager.checkAuthorization(userId, 'update');
    if (!authCheck.authorized) {
      await messagingAdapter.answerCallbackQuery(callbackQueryId, '❌ Only support staff can update status', true);
      return;
    }

    // Map short status code to full status value
    const newStatus = STATUS_CODES[statusCode];
    if (!newStatus) {
      await messagingAdapter.answerCallbackQuery(callbackQueryId, '❌ Invalid status');
      return;
    }

    const issue = await issueManager.getIssue(issueId);
    if (!issue) {
      await messagingAdapter.answerCallbackQuery(callbackQueryId, '❌ Issue not found');
      return;
    }

    // Check if issue is in terminal state
    if (TERMINAL_STATUSES.includes(issue.status)) {
      await messagingAdapter.answerCallbackQuery(callbackQueryId, '❌ Ticket already closed/confirmed', true);
      return;
    }

    // Check ticket ownership: if assigned, only the assigned staff can update
    if (issue.assigned_to && issue.assigned_to !== userId) {
      await messagingAdapter.answerCallbackQuery(
        callbackQueryId, 
        `❌ This ticket is assigned to ${issue.assigned_to_name || 'another staff member'}. Only they can update it.`,
        true
      );
      return;
    }

    // ── RESOLVE or CANCEL (STAFF) requires remarks ──
    if (newStatus === ISSUE_STATUS.RESOLVED || newStatus === ISSUE_STATUS.RESOLVED_WITH_ISSUES || newStatus === ISSUE_STATUS.CANCELLED_STAFF) {
      // Store pending state — next message from this user in this group = remarks
      const remarksKey = `${chatId}_${userId}`;
      const isCancellation = newStatus === ISSUE_STATUS.CANCELLED_STAFF;
      const entry = {
        issueId,
        statusCode,
        newStatus,
        messageId,
        oldStatus: issue.status,
        description: issue.description,
        isCancellation,
        timestamp: Date.now(),
      };

      // Queue-based: push to array so multiple resolves don't overwrite each other
      if (!this.pendingRemarks.has(remarksKey)) {
        this.pendingRemarks.set(remarksKey, []);
      }
      const queue = this.pendingRemarks.get(remarksKey);
      queue.push(entry);

      await messagingAdapter.answerCallbackQuery(callbackQueryId, isCancellation ? '📝 Please provide a reason for cancellation' : '📝 Please type your remarks now');

      // Only show the prompt if this is the first (or only) item in queue
      if (queue.length === 1) {
        const promptTitle = isCancellation ? '📝 CANCELLATION REASON REQUIRED' : '📝 REMARKS REQUIRED';
        const promptAction = isCancellation 
          ? 'please REPLY to this message with the reason for cancelling this ticket.'
          : 'please REPLY to this message with your remarks describing what was done to resolve this issue.';
        await messagingAdapter.sendMessage(chatId, `${promptTitle}\n\n📋 Issue: ${issueId}\n\n📄 Subject:\n${issue.description}\n\n@${userName}, ${promptAction}\n\n⚠️ Important: Use the REPLY function to respond to this message.\n\n💡 Type /cancel_remarks to skip`);
      } else {
        await messagingAdapter.sendMessage(chatId, `📝 Queued: ${issueId} (${queue.length} tickets awaiting remarks)\n\nFinish remarks for ${queue[0].issueId} first, then this one will be next.`);
      }

      return;
    }

    // ── Non-resolve statuses: update immediately ──
    const oldStatus = issue.status;
    const success = await issueManager.updateIssueStatus(issueId, newStatus, userId, userName);
    if (!success) {
      await messagingAdapter.answerCallbackQuery(callbackQueryId, '❌ Failed to update status');
      return;
    }

    await messagingAdapter.answerCallbackQuery(callbackQueryId, `✅ Updated to ${STATUS_LABELS[newStatus]}`);

    // Edit the ticket message to reflect new status + show appropriate buttons
    const updatedText = this.formatUpdatedTicketMessage(issue, newStatus, userName);
    const newButtons = this.getStatusButtons(issueId, newStatus);
    await messagingAdapter.editMessageText(
      chatId, messageId, updatedText,
      newButtons.length > 0 ? newButtons : null
    );

    // Notify employee and central monitoring
    await routingService.notifyStatusUpdate(issue, oldStatus, newStatus, userName);

    logger.info(`[MessageHandler] Status updated via button: ${issueId} ${oldStatus} → ${newStatus} by ${userName}`);
  }

  /**
   * Process remarks typed by support staff after clicking resolve or cancel
   */
  async processRemarks(remarksKey, remarks, userId, chatId, userName) {
    const queue = this.pendingRemarks.get(remarksKey);
    if (!queue || queue.length === 0) return;

    // Take the first (oldest) pending item
    const pending = queue.shift();
    if (queue.length === 0) this.pendingRemarks.delete(remarksKey);

    const { issueId, newStatus, messageId, oldStatus, isCancellation } = pending;

    // Update with remarks
    const success = await issueManager.resolveWithRemarks(issueId, newStatus, remarks, userId, userName);
    if (!success) {
      await messagingAdapter.sendMessage(chatId, '❌ Failed to update issue status.');
      return;
    }

    const issue = await issueManager.getIssue(issueId);
    const statusLabel = STATUS_LABELS[newStatus] || newStatus;

    // Confirm in group
    await messagingAdapter.sendMessage(chatId, `✅ STATUS UPDATED

📋 Issue: ${issueId}
📊 Status: ${STATUS_LABELS[oldStatus] || oldStatus} → ${statusLabel}
👤 Updated by: ${userName}

📝 ${isCancellation ? 'Reason' : 'Remarks'}:
${remarks}`);

    // Edit the original ticket message
    const updatedText = this.formatUpdatedTicketMessage(issue, newStatus, userName, remarks);
    await messagingAdapter.editMessageText(chatId, messageId, updatedText, null);

    // Notify employee and central monitoring
    await routingService.notifyStatusUpdate(issue, oldStatus, newStatus, userName, remarks);

    if (isCancellation) {
      // Notify employee that their ticket was cancelled with reason
      await messagingAdapter.sendMessage(
        issue.employee_id,
        `❌ TICKET CANCELLED

📋 Issue ID: ${issueId}
👤 Cancelled by: ${userName}

📝 Reason:
${remarks}

If you have questions, please contact our support team.
To create a new ticket, send any message.`
      );
    } else {
      // Send confirmation request to employee with remarks (for resolve)
      await this.sendConfirmationRequest(issue, newStatus, userName, remarks);
    }

    logger.info(`[MessageHandler] ${isCancellation ? 'Cancelled' : 'Resolved'} ${issueId} with remarks by ${userName}`);

    // Prompt for next queued ticket if any remain
    if (queue.length > 0) {
      const next = queue[0];
      const nextIssue = await issueManager.getIssue(next.issueId);
      const description = nextIssue ? nextIssue.description : 'N/A';
      await messagingAdapter.sendMessage(chatId, `📝 REMARKS REQUIRED\n\n📋 Issue: ${next.issueId}\n\n📄 Subject:\n${description}\n\nPlease REPLY to this message with your remarks for this ticket.\n\n⚠️ Important: Use the REPLY function to respond to this message.\n\n💡 Type /cancel_remarks to skip`);
    }
  }

  /**
   * Cleanup stale pending remarks (older than 15 minutes)
   */
  cleanupPendingRemarks() {
    const now = Date.now();
    const maxAge = 15 * 60 * 1000; // 15 minutes
    for (const [key, queue] of this.pendingRemarks.entries()) {
      // Filter out stale entries from the queue
      const filtered = queue.filter(entry => now - entry.timestamp <= maxAge);
      if (filtered.length === 0) {
        this.pendingRemarks.delete(key);
        logger.info(`[MessageHandler] Cleaned up all stale pending remarks for ${key}`);
      } else if (filtered.length < queue.length) {
        this.pendingRemarks.set(key, filtered);
        logger.info(`[MessageHandler] Cleaned up ${queue.length - filtered.length} stale remarks for ${key}`);
      }
    }
  }

  /**
   * Handle employee confirmation callback (confirm resolved / not resolved)
   */
  async handleConfirmCallback(callbackQueryId, userId, userName, chatId, messageId, parts) {
    if (parts.length < 3) {
      await messagingAdapter.answerCallbackQuery(callbackQueryId, '❌ Invalid callback data');
      return;
    }

    const issueId = parts[1];
    const action = parts[2]; // 'yes' or 'no'

    const issue = await issueManager.getIssue(issueId);
    if (!issue) {
      await messagingAdapter.answerCallbackQuery(callbackQueryId, '❌ Issue not found');
      return;
    }

    // Verify this is the ticket creator
    if (issue.employee_id !== userId) {
      await messagingAdapter.answerCallbackQuery(callbackQueryId, '❌ Only the ticket creator can confirm', true);
      return;
    }

    if (TERMINAL_STATUSES.includes(issue.status)) {
      await messagingAdapter.answerCallbackQuery(callbackQueryId, 'ℹ️ This ticket is already closed');
      return;
    }

    if (action === 'yes') {
      // Employee confirms resolution
      const oldStatus = issue.status;
      const success = await issueManager.updateIssueStatus(issueId, ISSUE_STATUS.CONFIRMED, userId, userName);
      if (success) {
        await messagingAdapter.answerCallbackQuery(callbackQueryId, '✅ Confirmed!');

        const updatedText = `✅ TICKET CONFIRMED\n\n📋 Issue ${issueId} has been confirmed as resolved.\nThank you for your feedback!\n\nIf you have other issues, send any message to create a new ticket.`;
        await messagingAdapter.editMessageText(chatId, messageId, updatedText);

        // Notify support group
        await routingService.notifyStatusUpdate(issue, oldStatus, ISSUE_STATUS.CONFIRMED, userName + ' (Employee)');
      }
    } else if (action === 'no') {
      // Employee says NOT resolved → reopen ticket
      const oldStatus = issue.status;
      const success = await issueManager.updateIssueStatus(issueId, ISSUE_STATUS.IN_PROCESS, userId, userName);
      if (success) {
        await messagingAdapter.answerCallbackQuery(callbackQueryId, '📋 Ticket reopened');

        const updatedText = `🔄 TICKET REOPENED\n\n📋 Issue ${issueId} has been reopened.\nOur support team has been notified and will follow up.\n\nThank you for your feedback!`;
        await messagingAdapter.editMessageText(chatId, messageId, updatedText);

        // Notify support group that employee says not resolved
        await routingService.notifyReopened(issue, userName);
      }
    }
  }

  /**
   * Handle employee cancel ticket callback
   */
  async handleCancelCallback(callbackQueryId, userId, userName, chatId, messageId, parts) {
    if (parts.length < 2) {
      await messagingAdapter.answerCallbackQuery(callbackQueryId, '❌ Invalid callback data');
      return;
    }

    const issueId = parts[1];
    const issue = await issueManager.getIssue(issueId);

    if (!issue) {
      await messagingAdapter.answerCallbackQuery(callbackQueryId, '❌ Issue not found');
      return;
    }

    // Verify this is the ticket creator
    if (issue.employee_id !== userId) {
      await messagingAdapter.answerCallbackQuery(callbackQueryId, '❌ Only the ticket creator can cancel', true);
      return;
    }

    if (TERMINAL_STATUSES.includes(issue.status)) {
      await messagingAdapter.answerCallbackQuery(callbackQueryId, 'ℹ️ This ticket is already closed');
      return;
    }

    const oldStatus = issue.status;
    const success = await issueManager.updateIssueStatus(issueId, ISSUE_STATUS.CANCELLED_USER, userId, userName);

    if (success) {
      await messagingAdapter.answerCallbackQuery(callbackQueryId, '✅ Ticket cancelled');

      const updatedText = `❌ TICKET CANCELLED\n\n📋 Issue ${issueId} has been cancelled by you.\n\nIf you need help, send any message to create a new ticket.`;
      await messagingAdapter.editMessageText(chatId, messageId, updatedText);

      // Notify support group
      await routingService.notifyStatusUpdate(issue, oldStatus, ISSUE_STATUS.CANCELLED_USER, userName + ' (Employee)');
    }
  }

  /**
   * Send confirmation request to the employee who created the ticket
   * Called when support marks a ticket as resolved/resolved-with-issues
   */
  async sendConfirmationRequest(issue, newStatus, updatedBy, remarks = '') {
    const statusLabel = STATUS_LABELS[newStatus] || newStatus;

    let text = `📋 ISSUE STATUS UPDATE

📋 Issue ID: ${issue.issue_id}
📊 Status: ${statusLabel}
👤 Updated by: ${updatedBy}`;

    if (remarks) {
      text += `\n\n📝 Remarks:\n${remarks}`;
    }

    text += `\n\n${newStatus === 'resolved'
      ? 'Your issue has been marked as resolved.'
      : 'Your issue has been resolved with some remaining issues noted.'
    }\n\nPlease confirm if the issue has been resolved to your satisfaction.\n\n⚠️ If you don't respond within 7 days, the ticket will be automatically confirmed.`;

    const buttons = [
      [
        { text: '✅ Confirm Resolved', callback_data: `cf:${issue.issue_id}:yes` },
        { text: '❌ Not Resolved', callback_data: `cf:${issue.issue_id}:no` }
      ]
    ];

    await messagingAdapter.sendInlineKeyboard(issue.employee_id, text, buttons);
  }

  /**
   * Format updated ticket message for the group chat (after status change)
   */
  formatUpdatedTicketMessage(issue, newStatus, updatedBy, remarks = '') {
    const statusLabel = STATUS_LABELS[newStatus] || newStatus;

    let text = `📋 HELPDESK ISSUE

📋 Issue ID: ${issue.issue_id}
🏢 Branch: ${issue.branch}
Department: ${issue.department}
Employee: ${issue.employee_name}
Category: ${issue.category}
⚠️ Urgency: ${issue.urgency}
Contact: ${issue.contact_person}

📝 Description:
${issue.description}

📊 Status: ${statusLabel}
🔄 Updated by: ${updatedBy}`;

    if (issue.assigned_to) {
      text += `\n👤 Assigned to: ${issue.assigned_to_name || issue.assigned_to}`;
    }

    if (remarks) {
      text += `\n\n📝 Remarks:\n${remarks}`;
    }

    text += `\n\nCreated: ${new Date(issue.created_at).toLocaleString()}`;

    return text;
  }

  /**
   * Get inline status buttons based on current ticket status
   * Shows only valid status transitions
   */
  getStatusButtons(issueId, currentStatus) {
    const buttons = [];

    switch (currentStatus) {
      case 'pending':
        buttons.push([
          { text: '🔧 In Process', callback_data: `st:${issueId}:ip` },
          { text: '❌ Cancel (Staff)', callback_data: `st:${issueId}:cs` }
        ]);
        break;
      case 'in-process':
        buttons.push([
          { text: '✅ Resolved', callback_data: `st:${issueId}:rv` },
          { text: '⚠️ Resolved w/ Issues', callback_data: `st:${issueId}:rwi` }
        ]);
        buttons.push([
          { text: '❌ Cancel (Staff)', callback_data: `st:${issueId}:cs` }
        ]);
        break;
      // resolved/resolved-with-issues: waiting for user confirmation
      // confirmed/cancelled: terminal states — no buttons
      default:
        break;
    }

    return buttons;
  }

  /**
   * Start a new issue creation flow
   * 
   * CORRECTED FLOW: Ask for BRANCH first (routing key), then department (context)
   * 
   * @param {string} userId - User ID
   * @param {string} chatId - Chat ID
   * @param {object} userProfile - User profile
   */
  async startNewIssue(userId, chatId, userProfile) {
    await conversationManager.startConversation(userId, userProfile);
    
    await messagingAdapter.sendKeyboard(
      chatId,
      '🏢 Welcome to the Helpdesk Bot!\n\nWhich branch/company are you from?',
      this.getBranchKeyboard()
    );
  }

  /**
   * Process conversation step based on user input
   * 
   * CORRECTED FLOW:
   * 1. BRANCH (routing key)
   * 2. DEPARTMENT (context)
   * 3. CATEGORY
   * 4. URGENCY
   * 5. DESCRIPTION
   * 6. CONTACT
   * 7. CONFIRMATION
   * 
   * @param {string} userId - User ID
   * @param {string} chatId - Chat ID
   * @param {object} conversation - Conversation object
   * @param {string} messageText - User's message
   * @param {object} userProfile - User profile
   */
  async processConversationStep(userId, chatId, conversation, messageText, userProfile) {
    const currentStep = conversation.currentStep;

    switch (currentStep) {
      case CONVERSATION_STEPS.BRANCH:
        await this.handleBranchStep(userId, chatId, messageText);
        break;

      case CONVERSATION_STEPS.DEPARTMENT:
        await this.handleDepartmentStep(userId, chatId, messageText);
        break;

      case CONVERSATION_STEPS.CATEGORY:
        await this.handleCategoryStep(userId, chatId, messageText);
        break;

      case CONVERSATION_STEPS.URGENCY:
        await this.handleUrgencyStep(userId, chatId, messageText);
        break;

      case CONVERSATION_STEPS.DESCRIPTION:
        await this.handleDescriptionStep(userId, chatId, messageText);
        break;

      case CONVERSATION_STEPS.CONTACT:
        await this.handleContactStep(userId, chatId, messageText, userProfile);
        break;

      case CONVERSATION_STEPS.CONFIRMATION:
        await this.handleConfirmationStep(userId, chatId, messageText);
        break;

      default:
        await messagingAdapter.sendMessage(chatId, '❌ Unknown step. Let\'s start over.');
        await conversationManager.endConversation(userId);
        await this.startNewIssue(userId, chatId, userProfile);
    }
  }

  /**
   * Handle branch selection (ROUTING KEY)
   * This determines which support group will receive the issue
   */
  async handleBranchStep(userId, chatId, branch) {
    // Validate branch input
    const validBranches = Object.values(BRANCHES);
    if (!validBranches.includes(branch)) {
      await messagingAdapter.sendMessage(
        chatId,
        `❌ Invalid selection: "${branch}"\n\nPlease use the keyboard buttons to select your branch.`
      );
      return;
    }

    await conversationManager.updateConversation(
      userId,
      'branch',
      branch,
      CONVERSATION_STEPS.DEPARTMENT
    );

    await messagingAdapter.sendKeyboard(
      chatId,
      '📂 Please select your department:',
      messagingAdapter.getDepartmentKeyboard()
    );
  }

  /**
   * Handle department selection (CONTEXT ONLY)
   * This is NOT used for routing - only stored as metadata
   */
  async handleDepartmentStep(userId, chatId, department) {
    // Validate department input
    const validDepartments = Object.values(DEPARTMENTS);
    if (!validDepartments.includes(department)) {
      await messagingAdapter.sendMessage(
        chatId,
        `❌ Invalid selection: "${department}"\n\nPlease use the keyboard buttons to select your department.`
      );
      return;
    }

    await conversationManager.updateConversation(
      userId,
      'department',
      department,
      CONVERSATION_STEPS.CATEGORY
    );

    await messagingAdapter.sendKeyboard(
      chatId,
      '🔧 Please select the issue category:',
      messagingAdapter.getCategoryKeyboard()
    );
  }

  /**
   * Handle category selection
   */
  async handleCategoryStep(userId, chatId, category) {
    // Validate category input
    const validCategories = Object.values(require('./constants').CATEGORIES);
    if (!validCategories.includes(category)) {
      await messagingAdapter.sendMessage(
        chatId,
        `❌ Invalid selection: "${category}"\n\nPlease use the keyboard buttons to select a category.`
      );
      return;
    }

    await conversationManager.updateConversation(
      userId,
      'category',
      category,
      CONVERSATION_STEPS.URGENCY
    );

    await messagingAdapter.sendKeyboard(
      chatId,
      '⚠️ Please select the urgency level:',
      messagingAdapter.getUrgencyKeyboard()
    );
  }

  /**
   * Handle urgency selection
   */
  async handleUrgencyStep(userId, chatId, urgency) {
    // Validate urgency input
    const validUrgencies = Object.values(require('./constants').URGENCY_LEVELS);
    if (!validUrgencies.includes(urgency)) {
      await messagingAdapter.sendMessage(
        chatId,
        `❌ Invalid selection: "${urgency}"\n\nPlease use the keyboard buttons to select urgency.`
      );
      return;
    }

    await conversationManager.updateConversation(
      userId,
      'urgency',
      urgency,
      CONVERSATION_STEPS.DESCRIPTION
    );

    await messagingAdapter.sendMessage(
      chatId,
      '📝 Please describe the issue in detail:\n\n(Type your description and send)'
    );
  }

  /**
   * Handle description input
   */
  async handleDescriptionStep(userId, chatId, description) {
    await conversationManager.updateConversation(
      userId,
      'description',
      description,
      CONVERSATION_STEPS.CONTACT
    );

    await messagingAdapter.sendMessage(
      chatId,
      '📞 Who should we contact regarding this issue?\n\n(Enter name and contact info, or type "ME" to use your info)'
    );
  }

  /**
   * Handle contact person input
   */
  async handleContactStep(userId, chatId, contact, userProfile) {
    const contactPerson = contact.toUpperCase() === 'ME' ? userProfile.name : contact;
    
    await conversationManager.updateConversation(
      userId,
      'contactPerson',
      contactPerson,
      CONVERSATION_STEPS.CONFIRMATION
    );

    // Show summary for confirmation
    const data = await conversationManager.getConversationData(userId);
    
    const summary = `📋 ISSUE SUMMARY

🏢 Branch: ${data.branch}
Department: ${data.department}
Category: ${data.category}
⚠️ Urgency: ${data.urgency}
Contact: ${data.contactPerson}

📝 Description:
${data.description}

Is this correct?`;

    await messagingAdapter.sendKeyboard(
      chatId,
      summary,
      messagingAdapter.getConfirmationKeyboard()
    );
  }

  /**
   * Handle confirmation (Yes/No)
   */
  async handleConfirmationStep(userId, chatId, response) {
    const upperResponse = response.toUpperCase();

    if (upperResponse.includes('YES') || upperResponse === '✅ YES, SUBMIT') {
      await this.submitIssue(userId, chatId);
    } else if (upperResponse.includes('NO') || upperResponse === '❌ NO, CANCEL') {
      await conversationManager.endConversation(userId);
      await messagingAdapter.sendMessage(
        chatId,
        '❌ Issue creation cancelled.\n\nSend any message to start a new issue.'
      );
    } else {
      await messagingAdapter.sendMessage(
        chatId,
        'Please click one of the buttons: ✅ Yes, Submit or ❌ No, Cancel'
      );
    }
  }

  /**
   * Submit the issue to the system
   * 
   * AUTOMATED TICKET CREATION:
   * - Bot is the authoritative ticket creator
   * - No manual encoding or approval needed
   * - Department representatives are NOT required for ticket creation
   * - Ticket is immediately created and routed to appropriate groups
   */
  async submitIssue(userId, chatId) {
    const conversation = await conversationManager.getConversation(userId);
    
    if (!conversation) {
      await messagingAdapter.sendMessage(chatId, '❌ Session expired. Please start over.');
      return;
    }

    const data = conversation.data;

    // BOT CREATES TICKET IMMEDIATELY (no approval workflow)
    // This is the single source of truth for ticket creation
    const issue = await issueManager.createIssue({
      employeeId: userId,
      employeeName: conversation.userName,
      branch: data.branch,           // ROUTING KEY
      department: data.department,   // METADATA
      category: data.category,
      urgency: data.urgency,
      description: data.description,
      contactPerson: data.contactPerson,
    });

    // End conversation
    await conversationManager.endConversation(userId);

    // Confirm to employee with cancel button
    const cancelButton = [
      [{ text: '❌ Cancel This Ticket', callback_data: `cancel:${issue.issueId}` }]
    ];

    await messagingAdapter.sendInlineKeyboard(
      chatId,
      `✅ Issue created successfully!\n\n📋 Issue ID: ${issue.issueId}\n📊 Status: ⏳ Pending\n\nOur support team has been notified and will respond soon.\nYou will receive status updates automatically.`,
      cancelButton
    );

    // ROUTE TO APPROPRIATE GROUPS
    // Uses routing service for intelligent multi-group delivery:
    // 1. Branch-specific action group (support can respond)
    // 2. Central monitoring group (visibility only)
    await routingService.routeIssue(issue);

    logger.info(`[MessageHandler] Issue ${issue.issueId} submitted by ${conversation.userName}`);
  }

  /**
   * Get branch selection keyboard
   * @returns {array} - Button configuration array
   */
  getBranchKeyboard() {
    return Object.values(BRANCHES).map(branch => ({
      text: branch,
      value: branch,
      columns: 3,
      rows: 1,
    }));
  }
}

// Export singleton instance
module.exports = new MessageHandler();
