/**
 * Message Handler
 * Routes incoming messages and processes user input
 * Handles conversation flow and support staff commands
 */

const conversationManager = require('./conversationManager');
const issueManager = require('./issueManager');
const viberService = require('./viberService');
const permissionsManager = require('./permissionsManager');
const { CONVERSATION_STEPS, SUPPORT_KEYWORDS, ISSUE_STATUS } = require('./constants');

class MessageHandler {
  /**
   * Handle incoming text message
   * @param {object} message - Viber message object
   * @param {object} userProfile - User profile information
   */
  async handleMessage(message, userProfile) {
    const userId = userProfile.id;
    const userName = userProfile.name || 'User';
    const messageText = message.text.trim();

    console.log(`[MessageHandler] Received message from ${userName} (${userId}): ${messageText}`);

    // Check if this is a support staff command
    if (this.isSupportCommand(messageText)) {
      await this.handleSupportCommand(messageText, userId, userName);
      return;
    }

    // Check if user can create issues
    const authCheck = permissionsManager.checkAuthorization(userId, 'create');
    if (!authCheck.authorized) {
      await viberService.sendMessage(userId, authCheck.message);
      return;
    }

    // Check if user has active conversation
    const conversation = conversationManager.getConversation(userId);

    if (!conversation) {
      // Start new conversation
      await this.startNewIssue(userId, userProfile);
    } else {
      // Continue existing conversation
      await this.processConversationStep(userId, conversation, messageText, userProfile);
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
   * @param {string} userName - User name
   */
  async handleSupportCommand(text, userId, userName) {
    // Check if user is support staff
    const authCheck = permissionsManager.checkAuthorization(userId, 'update');
    if (!authCheck.authorized) {
      await viberService.sendMessage(userId, authCheck.message);
      return;
    }

    // Parse command: "ACK ISSUE-20260105-0001" or "ONGOING ISSUE-20260105-0001"
    const parts = text.trim().split(/\s+/);
    
    if (parts.length < 2) {
      await viberService.sendMessage(
        userId,
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
        await viberService.sendMessage(userId, '❌ Unknown command.');
        return;
    }

    // Get issue to verify it exists
    const issue = issueManager.getIssue(issueId);
    
    if (!issue) {
      await viberService.sendMessage(userId, `❌ Issue not found: ${issueId}`);
      return;
    }

    // Update issue status
    const success = issueManager.updateIssueStatus(issueId, newStatus, userId, userName);

    if (success) {
      // Confirm to support staff
      await viberService.sendMessage(
        userId,
        `✅ Updated ${issueId}\nStatus: ${issue.status} → ${newStatus}`
      );

      // Notify the employee who created the issue
      await viberService.notifyStatusUpdate(
        issue.employee_id,
        issueId,
        issue.status,
        newStatus,
        userName
      );

      console.log(`[MessageHandler] Status updated: ${issueId} → ${newStatus} by ${userName}`);
    } else {
      await viberService.sendMessage(userId, '❌ Failed to update issue status.');
    }
  }

  /**
   * Start a new issue creation flow
   * @param {string} userId - User ID
   * @param {object} userProfile - User profile
   */
  async startNewIssue(userId, userProfile) {
    conversationManager.startConversation(userId, userProfile);
    
    await viberService.sendKeyboard(
      userId,
      '🏢 Welcome to the Helpdesk Bot!\n\nPlease select your department:',
      viberService.getDepartmentKeyboard()
    );
  }

  /**
   * Process conversation step based on user input
   * @param {string} userId - User ID
   * @param {object} conversation - Conversation object
   * @param {string} messageText - User's message
   * @param {object} userProfile - User profile
   */
  async processConversationStep(userId, conversation, messageText, userProfile) {
    const currentStep = conversation.currentStep;

    switch (currentStep) {
      case CONVERSATION_STEPS.DEPARTMENT:
        await this.handleDepartmentStep(userId, messageText);
        break;

      case CONVERSATION_STEPS.CATEGORY:
        await this.handleCategoryStep(userId, messageText);
        break;

      case CONVERSATION_STEPS.URGENCY:
        await this.handleUrgencyStep(userId, messageText);
        break;

      case CONVERSATION_STEPS.DESCRIPTION:
        await this.handleDescriptionStep(userId, messageText);
        break;

      case CONVERSATION_STEPS.CONTACT:
        await this.handleContactStep(userId, messageText, userProfile);
        break;

      case CONVERSATION_STEPS.CONFIRMATION:
        await this.handleConfirmationStep(userId, messageText);
        break;

      default:
        await viberService.sendMessage(userId, '❌ Unknown step. Let\'s start over.');
        conversationManager.endConversation(userId);
        await this.startNewIssue(userId, userProfile);
    }
  }

  /**
   * Handle department selection
   */
  async handleDepartmentStep(userId, department) {
    conversationManager.updateConversation(
      userId,
      'department',
      department,
      CONVERSATION_STEPS.CATEGORY
    );

    await viberService.sendKeyboard(
      userId,
      '🔧 Please select the issue category:',
      viberService.getCategoryKeyboard()
    );
  }

  /**
   * Handle category selection
   */
  async handleCategoryStep(userId, category) {
    conversationManager.updateConversation(
      userId,
      'category',
      category,
      CONVERSATION_STEPS.URGENCY
    );

    await viberService.sendKeyboard(
      userId,
      '⚠️ Please select the urgency level:',
      viberService.getUrgencyKeyboard()
    );
  }

  /**
   * Handle urgency selection
   */
  async handleUrgencyStep(userId, urgency) {
    conversationManager.updateConversation(
      userId,
      'urgency',
      urgency,
      CONVERSATION_STEPS.DESCRIPTION
    );

    await viberService.sendMessage(
      userId,
      '📝 Please describe the issue in detail:\n\n(Type your description and send)'
    );
  }

  /**
   * Handle description input
   */
  async handleDescriptionStep(userId, description) {
    conversationManager.updateConversation(
      userId,
      'description',
      description,
      CONVERSATION_STEPS.CONTACT
    );

    await viberService.sendMessage(
      userId,
      '📞 Who should we contact regarding this issue?\n\n(Enter name and contact info, or type "ME" to use your info)'
    );
  }

  /**
   * Handle contact person input
   */
  async handleContactStep(userId, contact, userProfile) {
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

    await viberService.sendKeyboard(
      userId,
      summary,
      viberService.getConfirmationKeyboard()
    );
  }

  /**
   * Handle confirmation (Yes/No)
   */
  async handleConfirmationStep(userId, response) {
    const upperResponse = response.toUpperCase();

    if (upperResponse.includes('YES') || upperResponse === '✅ YES, SUBMIT') {
      await this.submitIssue(userId);
    } else if (upperResponse.includes('NO') || upperResponse === '❌ NO, CANCEL') {
      conversationManager.endConversation(userId);
      await viberService.sendMessage(
        userId,
        '❌ Issue creation cancelled.\n\nSend any message to start a new issue.'
      );
    } else {
      await viberService.sendMessage(
        userId,
        'Please click one of the buttons: ✅ Yes, Submit or ❌ No, Cancel'
      );
    }
  }

  /**
   * Submit the issue to the system
   */
  async submitIssue(userId) {
    const conversation = conversationManager.getConversation(userId);
    
    if (!conversation) {
      await viberService.sendMessage(userId, '❌ Session expired. Please start over.');
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
    await viberService.sendMessage(
      userId,
      `✅ Issue created successfully!\n\n📋 Issue ID: ${issue.issueId}\n\nOur support team has been notified and will respond soon.\n\nYou will receive status updates automatically.`
    );

    // Send to support group
    await viberService.sendIssueToSupportGroup(issue);

    console.log(`[MessageHandler] Issue ${issue.issueId} submitted by ${conversation.userName}`);
  }
}

// Export singleton instance
module.exports = new MessageHandler();
