/**
 * Message Handler
 * Routes incoming messages and processes user input
 * Handles conversation flow and support staff commands
 */

const conversationManager = require('./conversationManager');
const issueManager = require('./issueManager');
const telegramService = require('./telegramService');
const permissionsManager = require('./permissionsManager');
const { CONVERSATION_STEPS, SUPPORT_KEYWORDS, ISSUE_STATUS } = require('./constants');

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

    console.log(`[MessageHandler] Received message from ${userName} (${userId}): ${messageText}`);

    // Check if this is a support staff command
    if (this.isSupportCommand(messageText)) {
      await this.handleSupportCommand(messageText, userId, chatId, userName);
      return;
    }

    // Check if user can create issues
    const authCheck = permissionsManager.checkAuthorization(userId, 'create');
    if (!authCheck.authorized) {
      await telegramService.sendMessage(chatId, authCheck.message);
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
    const upperText = text.toUpperCase();
    return (
      upperText.startsWith(SUPPORT_KEYWORDS.ACK) ||
      upperText.startsWith(SUPPORT_KEYWORDS.ONGOING) ||
      upperText.startsWith(SUPPORT_KEYWORDS.RESOLVED)
    );
  }

  /**
   * Handle support staff commands (ACK, ONGOING, RESOLVED)
   * @param {string} text - Command text
   * @param {string} userId - User ID
   * @param {string} chatId - Chat ID
   * @param {string} userName - User name
   */
  async handleSupportCommand(text, userId, chatId, userName) {
    // Check if user is support staff
    const authCheck = permissionsManager.checkAuthorization(userId, 'update');
    if (!authCheck.authorized) {
      await telegramService.sendMessage(chatId, authCheck.message);
      return;
    }

    // Parse command: "ACK ISSUE-20260105-0001" or "ONGOING ISSUE-20260105-0001"
    const parts = text.trim().split(/\s+/);
    
    if (parts.length < 2) {
      await telegramService.sendMessage(
        chatId,
        '❌ Invalid command format.\n\nUsage:\nACK ISSUE-ID\nONGOING ISSUE-ID\nRESOLVED ISSUE-ID'
      );
      return;
    }

    const command = parts[0].toUpperCase();
    const issueId = parts[1];

    // Determine new status
    let newStatus;
    switch (command) {
      case SUPPORT_KEYWORDS.ACK:
        newStatus = ISSUE_STATUS.ACKNOWLEDGED;
        break;
      case SUPPORT_KEYWORDS.ONGOING:
        newStatus = ISSUE_STATUS.ONGOING;
        break;
      case SUPPORT_KEYWORDS.RESOLVED:
        newStatus = ISSUE_STATUS.RESOLVED;
        break;
      default:
        await telegramService.sendMessage(chatId, '❌ Unknown command.');
        return;
    }

    // Get issue to verify it exists
    const issue = issueManager.getIssue(issueId);
    
    if (!issue) {
      await telegramService.sendMessage(chatId, `❌ Issue not found: ${issueId}`);
      return;
    }

    // Update issue status
    const success = issueManager.updateIssueStatus(issueId, newStatus, userId, userName);

    if (success) {
      // Confirm to support staff
      await telegramService.sendMessage(
        chatId,
        `✅ Updated ${issueId}\nStatus: ${issue.status} → ${newStatus}`
      );

      // Notify the employee who created the issue
      await telegramService.notifyStatusUpdate(
        issue.employee_id,
        issueId,
        issue.status,
        newStatus,
        userName
      );

      console.log(`[MessageHandler] Status updated: ${issueId} → ${newStatus} by ${userName}`);
    } else {
      await telegramService.sendMessage(chatId, '❌ Failed to update issue status.');
    }
  }

  /**
   * Start a new issue creation flow
   * @param {string} userId - User ID
   * @param {string} chatId - Chat ID
   * @param {object} userProfile - User profile
   */
  async startNewIssue(userId, chatId, userProfile) {
    conversationManager.startConversation(userId, userProfile);
    
    await telegramService.sendKeyboard(
      chatId,
      '🏢 Welcome to the Helpdesk Bot!\n\nPlease select your department:',
      telegramService.getDepartmentKeyboard()
    );
  }

  /**
   * Process conversation step based on user input
   * @param {string} userId - User ID
   * @param {string} chatId - Chat ID
   * @param {object} conversation - Conversation object
   * @param {string} messageText - User's message
   * @param {object} userProfile - User profile
   */
  async processConversationStep(userId, chatId, conversation, messageText, userProfile) {
    const currentStep = conversation.currentStep;

    switch (currentStep) {
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
        await telegramService.sendMessage(chatId, '❌ Unknown step. Let\'s start over.');
        conversationManager.endConversation(userId);
        await this.startNewIssue(userId, chatId, userProfile);
    }
  }

  /**
   * Handle department selection
   */
  async handleDepartmentStep(userId, chatId, department) {
    conversationManager.updateConversation(
      userId,
      'department',
      department,
      CONVERSATION_STEPS.CATEGORY
    );

    await telegramService.sendKeyboard(
      chatId,
      '🔧 Please select the issue category:',
      telegramService.getCategoryKeyboard()
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

    await telegramService.sendKeyboard(
      chatId,
      '⚠️ Please select the urgency level:',
      telegramService.getUrgencyKeyboard()
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

    await telegramService.sendMessage(
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

    await telegramService.sendMessage(
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

🏢 Department: ${data.department}
🔧 Category: ${data.category}
⚠️ Urgency: ${data.urgency}
📞 Contact: ${data.contactPerson}

📝 Description:
${data.description}

Is this correct?
    `.trim();

    await telegramService.sendKeyboard(
      chatId,
      summary,
      telegramService.getConfirmationKeyboard()
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
      await telegramService.sendMessage(
        chatId,
        '❌ Issue creation cancelled.\n\nSend any message to start a new issue.'
      );
    } else {
      await telegramService.sendMessage(
        chatId,
        'Please click one of the buttons: ✅ Yes, Submit or ❌ No, Cancel'
      );
    }
  }

  /**
   * Submit the issue to the system
   */
  async submitIssue(userId, chatId) {
    const conversation = conversationManager.getConversation(userId);
    
    if (!conversation) {
      await telegramService.sendMessage(chatId, '❌ Session expired. Please start over.');
      return;
    }

    const data = conversation.data;

    // Create issue
    const issue = issueManager.createIssue({
      employeeId: userId,
      employeeName: conversation.userName,
      department: data.department,
      category: data.category,
      urgency: data.urgency,
      description: data.description,
      contactPerson: data.contactPerson,
    });

    // End conversation
    conversationManager.endConversation(userId);

    // Notify employee
    await telegramService.sendMessage(
      chatId,
      `✅ Issue created successfully!\n\n📋 Issue ID: ${issue.issueId}\n\nOur support team has been notified and will respond soon.\n\nYou will receive status updates automatically.`
    );

    // Send to support group
    await telegramService.sendIssueToSupportGroup(issue);

    console.log(`[MessageHandler] Issue ${issue.issueId} submitted by ${conversation.userName}`);
  }
}

// Export singleton instance
module.exports = new MessageHandler();
