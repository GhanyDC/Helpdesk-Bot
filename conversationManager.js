/**
 * Conversation Manager
 * Manages conversation state for each user
 * Tracks which step each user is on and stores their responses
 */

const { CONVERSATION_STEPS } = require('./constants');

class ConversationManager {
  constructor() {
    // In-memory storage for active conversations
    // Key: userId (Viber ID), Value: conversation state object
    this.activeConversations = new Map();
    
    // Session timeout (30 minutes of inactivity)
    this.sessionTimeout = 30 * 60 * 1000;
  }

  /**
   * Start a new conversation for a user
   * @param {string} userId - Viber user ID
   * @param {object} userInfo - User information (name, avatar, etc.)
   */
  startConversation(userId, userInfo = {}) {
    const conversation = {
      userId,
      userName: userInfo.name || 'Unknown User',
      currentStep: CONVERSATION_STEPS.DEPARTMENT,
      data: {},
      startTime: new Date(),
      lastActivity: new Date(),
    };

    this.activeConversations.set(userId, conversation);
    console.log(`[ConversationManager] Started conversation for user: ${userId}`);
    return conversation;
  }

  /**
   * Get active conversation for a user
   * @param {string} userId - Viber user ID
   * @returns {object|null} - Conversation object or null if not found
   */
  getConversation(userId) {
    const conversation = this.activeConversations.get(userId);
    
    if (!conversation) {
      return null;
    }

    // Check if conversation has timed out
    const now = new Date();
    const timeSinceLastActivity = now - conversation.lastActivity;
    
    if (timeSinceLastActivity > this.sessionTimeout) {
      console.log(`[ConversationManager] Conversation timeout for user: ${userId}`);
      this.endConversation(userId);
      return null;
    }

    // Update last activity time
    conversation.lastActivity = now;
    return conversation;
  }

  /**
   * Update conversation data and move to next step
   * @param {string} userId - Viber user ID
   * @param {string} field - Field name to store
   * @param {any} value - Value to store
   * @param {string} nextStep - Next conversation step
   */
  updateConversation(userId, field, value, nextStep) {
    const conversation = this.getConversation(userId);
    
    if (!conversation) {
      console.error(`[ConversationManager] No active conversation for user: ${userId}`);
      return null;
    }

    // Store the field value
    conversation.data[field] = value;
    
    // Move to next step
    conversation.currentStep = nextStep;
    conversation.lastActivity = new Date();

    console.log(`[ConversationManager] Updated ${field} for ${userId}, moving to ${nextStep}`);
    return conversation;
  }

  /**
   * End a conversation and remove from active list
   * @param {string} userId - Viber user ID
   */
  endConversation(userId) {
    const conversation = this.activeConversations.get(userId);
    
    if (conversation) {
      console.log(`[ConversationManager] Ending conversation for user: ${userId}`);
      this.activeConversations.delete(userId);
      return conversation.data;
    }
    
    return null;
  }

  /**
   * Check if user has an active conversation
   * @param {string} userId - Viber user ID
   * @returns {boolean}
   */
  hasActiveConversation(userId) {
    const conversation = this.getConversation(userId);
    return conversation !== null;
  }

  /**
   * Get current step for a user
   * @param {string} userId - Viber user ID
   * @returns {string|null}
   */
  getCurrentStep(userId) {
    const conversation = this.getConversation(userId);
    return conversation ? conversation.currentStep : null;
  }

  /**
   * Get conversation data for a user
   * @param {string} userId - Viber user ID
   * @returns {object|null}
   */
  getConversationData(userId) {
    const conversation = this.getConversation(userId);
    return conversation ? conversation.data : null;
  }

  /**
   * Clean up expired conversations (run periodically)
   */
  cleanupExpiredConversations() {
    const now = new Date();
    let cleanedCount = 0;

    for (const [userId, conversation] of this.activeConversations.entries()) {
      const timeSinceLastActivity = now - conversation.lastActivity;
      
      if (timeSinceLastActivity > this.sessionTimeout) {
        this.activeConversations.delete(userId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[ConversationManager] Cleaned up ${cleanedCount} expired conversations`);
    }
  }
}

// Export singleton instance
module.exports = new ConversationManager();
