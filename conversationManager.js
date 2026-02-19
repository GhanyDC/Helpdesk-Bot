/**
 * Conversation Manager — DB-Persisted Sessions
 *
 * Stores wizard state in the PostgreSQL sessions table.
 * Survives container restarts and redeploys.
 *
 * API is async — all callers must await.
 */

const db = require('./db');
const logger = require('./logger');
const { CONVERSATION_STEPS } = require('./constants');

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

class ConversationManager {
  /**
   * Start a new conversation for a user.
   * Overwrites any existing session.
   */
  async startConversation(userId, userInfo = {}) {
    const conversation = {
      userId,
      userName: userInfo.name || 'Unknown User',
      currentStep: CONVERSATION_STEPS.BRANCH,
      data: {},
      startTime: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    };

    await db.query(
      `INSERT INTO sessions (telegram_id, state, data, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (telegram_id) DO UPDATE
         SET state = $2, data = $3, updated_at = CURRENT_TIMESTAMP`,
      [userId, conversation.currentStep, JSON.stringify(conversation)]
    );

    logger.info('Session started', { userId });
    return conversation;
  }

  /**
   * Retrieve active conversation. Returns null if expired or absent.
   */
  async getConversation(userId) {
    const result = await db.query(
      'SELECT state, data, updated_at FROM sessions WHERE telegram_id = $1',
      [userId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const conversation = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;

    // Check timeout
    const lastActivity = new Date(conversation.lastActivity || row.updated_at);
    if (Date.now() - lastActivity.getTime() > SESSION_TIMEOUT_MS) {
      logger.info('Session expired', { userId });
      await this.endConversation(userId);
      return null;
    }

    // Touch lastActivity
    conversation.lastActivity = new Date().toISOString();
    await db.query(
      'UPDATE sessions SET data = $1, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = $2',
      [JSON.stringify(conversation), userId]
    );

    return conversation;
  }

  /**
   * Update a field and advance to the next step.
   */
  async updateConversation(userId, field, value, nextStep) {
    const conversation = await this.getConversation(userId);
    if (!conversation) {
      logger.warn('updateConversation: no active session', { userId });
      return null;
    }

    conversation.data[field] = value;
    conversation.currentStep = nextStep;
    conversation.lastActivity = new Date().toISOString();

    await db.query(
      'UPDATE sessions SET state = $1, data = $2, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = $3',
      [nextStep, JSON.stringify(conversation), userId]
    );

    logger.debug('Session updated', { userId, field, nextStep });
    return conversation;
  }

  /**
   * End (delete) a conversation and return collected data.
   */
  async endConversation(userId) {
    const result = await db.query(
      'DELETE FROM sessions WHERE telegram_id = $1 RETURNING data',
      [userId]
    );

    if (result.rows.length === 0) return null;

    const conversation = typeof result.rows[0].data === 'string'
      ? JSON.parse(result.rows[0].data)
      : result.rows[0].data;

    logger.info('Session ended', { userId });
    return conversation.data || conversation;
  }

  async hasActiveConversation(userId) {
    const c = await this.getConversation(userId);
    return c !== null;
  }

  async getCurrentStep(userId) {
    const c = await this.getConversation(userId);
    return c ? c.currentStep : null;
  }

  async getConversationData(userId) {
    const c = await this.getConversation(userId);
    return c ? c.data : null;
  }

  /**
   * Purge expired sessions (SQL-based — no in-memory scan).
   */
  async cleanupExpiredConversations() {
    const result = await db.query(
      `DELETE FROM sessions WHERE updated_at < CURRENT_TIMESTAMP - INTERVAL '30 minutes'`
    );
    if (result.rowCount > 0) {
      logger.info(`Cleaned up ${result.rowCount} expired sessions`);
    }
  }
}

module.exports = new ConversationManager();
