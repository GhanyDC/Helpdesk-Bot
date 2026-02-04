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
const issueManager = require('./issueManager');
const messagingAdapter = require('./messagingAdapter'); // Platform abstraction
const routingService = require('./routingService');     // Branch routing
const permissionsManager = require('./permissionsManager');
const statsService = require('./statsService');         // Statistics & metrics
const { CONVERSATION_STEPS, SUPPORT_KEYWORDS, ISSUE_STATUS, BRANCHES, DEPARTMENTS } = require('./constants');

class MessageHandler {
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

    console.log(`[MessageHandler] Received message from ${userName} (${userId}) in ${isGroupChat ? 'GROUP' : 'PRIVATE'}: ${messageText}`);

    // Check if this is a support command (/status) - MUST CHECK BEFORE OTHER COMMANDS
    if (this.isSupportCommand(messageText)) {
      if (!isGroupChat) {
        await messagingAdapter.sendMessage(chatId, '❌ Status updates can only be done in the support group.\n\nTo create a ticket, just send me a regular message.');
        return;
      }
      await this.handleSupportCommand(messageText, userId, chatId, userName);
      return;
    }

    // Check if this is a bot command (/stats, /open_issues, etc.)
    if (messageText.startsWith('/')) {
      await this.handleBotCommand(messageText, userId, chatId, userName, isGroupChat);
      return;
    }

    // Ticket creation only allowed in PRIVATE CHATS
    if (isGroupChat) {
      // Ignore regular messages in groups (only respond to commands)
      console.log(`[MessageHandler] Ignoring non-command message in group chat`);
      return;
    }

    // Check if user can create issues
    const authCheck = permissionsManager.checkAuthorization(userId, 'create');
    if (!authCheck.authorized) {
      await messagingAdapter.sendMessage(chatId, authCheck.message);
      return;
    }

    // Check if user has active conversation
    const conversation = conversationManager.getConversation(userId);

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

    console.log(`[MessageHandler] Bot command received: ${command}`);

    switch (command) {
      case '/stats':
        await this.handleStatsCommand(parts, chatId);
        break;

      case '/open_issues':
      case '/open':
        await this.handleOpenIssuesCommand(chatId);
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
   * @param {array} parts - Command parts
   * @param {string} chatId - Chat ID
   */
  async handleStatsCommand(parts, chatId) {
    if (parts.length === 1) {
      // /stats - show overall today's stats
      const message = statsService.formatTodayStatsMessage();
      await messagingAdapter.sendMessage(chatId, message);
    } else {
      // /stats <department> - show department-specific stats
      const deptInput = parts.slice(1).join(' ');
      
      // Try to match department (case-insensitive)
      const matchedDept = Object.values(DEPARTMENTS).find(
        dept => dept.toLowerCase() === deptInput.toLowerCase()
      );

      if (matchedDept) {
        const message = statsService.formatDepartmentStatsMessage(matchedDept);
        await messagingAdapter.sendMessage(chatId, message);
      } else {
        await messagingAdapter.sendMessage(
          chatId,
          `❌ Unknown department: "${deptInput}"\n\nAvailable departments:\n${Object.values(DEPARTMENTS).join(', ')}`
        );
      }
    }
  }

  /**
   * Handle /open_issues command
   * @param {string} chatId - Chat ID
   */
  async handleOpenIssuesCommand(chatId) {
    const message = statsService.formatOpenIssuesMessage();
    await messagingAdapter.sendMessage(chatId, message);
  }

  /**
   * Handle /help command
   * @param {string} chatId - Chat ID
   */
  async handleHelpCommand(chatId) {
    const helpMessage = `
🤖 HELPDESK BOT COMMANDS

📊 STATISTICS:
/stats - Today's overall statistics
/stats <department> - Department-specific stats
  Example: /stats Sales

📋 OPERATIONS:
/open_issues - View all open issues by department

🔧 SUPPORT STAFF ONLY:
/status <issue-id> pending - Mark as pending
/status <issue-id> in-progress - Mark as in progress
/status <issue-id> resolved - Mark as resolved
/status <issue-id> closed - Mark as closed
  Example: /status ISSUE-20260107-0023 in-progress

❓ HELP:
/help - Show this message

━━━━━━━━━━━━━━━━━━━
To create a new issue, just send any message to the bot.
    `.trim();

    await messagingAdapter.sendMessage(chatId, helpMessage);
  }

  /**
   * Handle support staff commands (/status)
   * @param {string} text - Command text
   * @param {string} userId - User ID
   * @param {string} chatId - Chat ID
   * @param {string} userName - User name
   */
  async handleSupportCommand(text, userId, chatId, userName) {
    // Check if user is support staff
    const authCheck = permissionsManager.checkAuthorization(userId, 'update');
    if (!authCheck.authorized) {
      await messagingAdapter.sendMessage(chatId, authCheck.message);
      return;
    }

    // Parse command: "/status ISSUE-20260105-0001 in-progress"
    const parts = text.trim().split(/\s+/);
    
    if (parts.length < 3) {
      await messagingAdapter.sendMessage(
        chatId,
        '❌ Invalid command format.\n\nUsage:\n/status ISSUE-ID pending\n/status ISSUE-ID in-progress\n/status ISSUE-ID resolved\n/status ISSUE-ID closed'
      );
      return;
    }

    const issueId = parts[1];
    const statusInput = parts[2].toLowerCase();

    // Validate status
    const validStatuses = Object.values(ISSUE_STATUS);
    if (!validStatuses.includes(statusInput)) {
      await messagingAdapter.sendMessage(
        chatId,
        `❌ Invalid status. Valid statuses: ${validStatuses.join(', ')}`
      );
      return;
    }

    const newStatus = statusInput;

    // Get issue to verify it exists
    const issue = issueManager.getIssue(issueId);
    
    if (!issue) {
      await messagingAdapter.sendMessage(chatId, `❌ Issue not found: ${issueId}`);
      return;
    }

    // Update issue status
    const success = issueManager.updateIssueStatus(issueId, newStatus, userId, userName);

    if (success) {
      // Confirm to support staff
      await messagingAdapter.sendMessage(
        chatId,
        `✅ Updated ${issueId}\nStatus: ${issue.status} → ${newStatus}`
      );

      // Notify all stakeholders (employee + central monitoring)
      // Using routingService to handle multi-destination notifications
      await routingService.notifyStatusUpdate(
        issue,
        issue.status,
        newStatus,
        userName
      );

      console.log(`[MessageHandler] Status updated: ${issueId} → ${newStatus} by ${userName}`);
    } else {
      await messagingAdapter.sendMessage(chatId, '❌ Failed to update issue status.');
    }
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
    conversationManager.startConversation(userId, userProfile);
    
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
        conversationManager.endConversation(userId);
        await this.startNewIssue(userId, chatId, userProfile);
    }
  }

  /**
   * Handle branch selection (ROUTING KEY)
   * This determines which support group will receive the issue
   */
  async handleBranchStep(userId, chatId, branch) {
    conversationManager.updateConversation(
      userId,
      'branch',
      branch,
      CONVERSATION_STEPS.DEPARTMENT
    );

    await messagingAdapter.sendKeyboard(
      chatId,
      '📂 Please select your department:\n\n(This is for context only)',
      messagingAdapter.getDepartmentKeyboard()
    );
  }

  /**
   * Handle department selection (CONTEXT ONLY)
   * This is NOT used for routing - only stored as metadata
   */
  async handleDepartmentStep(userId, chatId, department) {
    conversationManager.updateConversation(
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
    conversationManager.updateConversation(
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
    conversationManager.updateConversation(
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
    conversationManager.updateConversation(
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
    
    conversationManager.updateConversation(
      userId,
      'contactPerson',
      contactPerson,
      CONVERSATION_STEPS.CONFIRMATION
    );

    // Show summary for confirmation
    const data = conversationManager.getConversationData(userId);
    
    const summary = `
📋 ISSUE SUMMARY

🏢 Branch: ${data.branch}
📂 Department: ${data.department}
🔧 Category: ${data.category}
⚠️ Urgency: ${data.urgency}
📞 Contact: ${data.contactPerson}

📝 Description:
${data.description}

Is this correct?
    `.trim();

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
      conversationManager.endConversation(userId);
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
   */
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
    const conversation = conversationManager.getConversation(userId);
    
    if (!conversation) {
      await messagingAdapter.sendMessage(chatId, '❌ Session expired. Please start over.');
      return;
    }

    const data = conversation.data;

    // BOT CREATES TICKET IMMEDIATELY (no approval workflow)
    // This is the single source of truth for ticket creation
    const issue = issueManager.createIssue({
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
    conversationManager.endConversation(userId);

    // Confirm to employee
    await messagingAdapter.sendMessage(
      chatId,
      `✅ Issue created successfully!\n\n📋 Issue ID: ${issue.issueId}\n\nOur support team has been notified and will respond soon.\n\nYou will receive status updates automatically.`
    );

    // ROUTE TO APPROPRIATE GROUPS
    // Uses routing service for intelligent multi-group delivery:
    // 1. Branch-specific action group (support can respond)
    // 2. Central monitoring group (visibility only)
    await routingService.routeIssue(issue);

    console.log(`[MessageHandler] Issue ${issue.issueId} submitted by ${conversation.userName}`);
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
