/**
 * User ID Logger Service
 * 
 * AUTOMATED USER ID DISCOVERY
 * 
 * Purpose:
 * Automatically logs Telegram user IDs when users interact with the bot.
 * Makes it easy for admins to get IDs for SUPPORT_STAFF_IDS configuration.
 * 
 * Features:
 * - Logs all users who message the bot
 * - Stores in SQLite database
 * - Admin command /whoami for users to get their own ID
 * - Admin command /list_users to see all registered users
 * - Color-coded console output for easy reading
 * 
 * Usage:
 * 1. Integrated automatically in server.js
 * 2. Users send /whoami to get their ID
 * 3. Admins use /list_users to see all users
 * 4. Copy IDs from output to .env file
 * 
 * Author: Tech Solutions Inc.
 * Date: February 2026
 */

const Database = require('better-sqlite3');
const path = require('path');
const config = require('./config');

class UserIdLogger {
  constructor() {
    this.db = null;
    this.initDatabase();
  }

  /**
   * Initialize database for user tracking
   */
  initDatabase() {
    try {
      // Use same database as helpdesk
      this.db = new Database(config.database.path);
      
      // Create user_log table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS user_log (
          user_id TEXT PRIMARY KEY,
          username TEXT,
          first_name TEXT,
          last_name TEXT,
          full_name TEXT,
          chat_id TEXT,
          first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
          message_count INTEGER DEFAULT 1
        )
      `);

      console.log('[UserIdLogger] Database initialized successfully');
    } catch (error) {
      console.error('[UserIdLogger] Database initialization error:', error);
    }
  }

  /**
   * Log a user interaction
   * Called automatically when any user messages the bot
   * 
   * @param {object} userInfo - Telegram user information
   */
  logUser(userInfo) {
    try {
      const {
        id,
        username,
        first_name,
        last_name,
        chat_id,
      } = userInfo;

      const fullName = [first_name, last_name].filter(Boolean).join(' ');

      // Check if user exists
      const existing = this.db.prepare('SELECT * FROM user_log WHERE user_id = ?').get(id.toString());

      if (existing) {
        // Update existing user
        this.db.prepare(`
          UPDATE user_log 
          SET username = ?,
              first_name = ?,
              last_name = ?,
              full_name = ?,
              chat_id = ?,
              last_seen = CURRENT_TIMESTAMP,
              message_count = message_count + 1
          WHERE user_id = ?
        `).run(username || null, first_name || null, last_name || null, fullName, chat_id.toString(), id.toString());
      } else {
        // Insert new user
        this.db.prepare(`
          INSERT INTO user_log (user_id, username, first_name, last_name, full_name, chat_id)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(id.toString(), username || null, first_name || null, last_name || null, fullName, chat_id.toString());

        // Log new user to console with highlighting
        console.log('\n┌─────────────────────────────────────────────────────────────┐');
        console.log('│ 🆕 NEW USER DETECTED                                        │');
        console.log('├─────────────────────────────────────────────────────────────┤');
        console.log(`│ Name: ${fullName.padEnd(51)}│`);
        console.log(`│ User ID: ${id.toString().padEnd(47)}│`);
        console.log(`│ Username: @${(username || 'none').padEnd(46)}│`);
        console.log(`│ Chat ID: ${chat_id.toString().padEnd(47)}│`);
        console.log('└─────────────────────────────────────────────────────────────┘\n');
        console.log(`💡 To add as support staff, update .env:`);
        console.log(`   SUPPORT_STAFF_IDS=${id},...\n`);
      }
    } catch (error) {
      console.error('[UserIdLogger] Error logging user:', error);
    }
  }

  /**
   * Get all logged users
   * @returns {array} - Array of user records
   */
  getAllUsers() {
    try {
      return this.db.prepare(`
        SELECT * FROM user_log 
        ORDER BY last_seen DESC
      `).all();
    } catch (error) {
      console.error('[UserIdLogger] Error getting users:', error);
      return [];
    }
  }

  /**
   * Get a specific user by ID
   * @param {string} userId - Telegram user ID
   * @returns {object|null} - User record or null
   */
  getUser(userId) {
    try {
      return this.db.prepare('SELECT * FROM user_log WHERE user_id = ?').get(userId);
    } catch (error) {
      console.error('[UserIdLogger] Error getting user:', error);
      return null;
    }
  }

  /**
   * Format user list as a readable message
   * @returns {string} - Formatted user list
   */
  formatUserList() {
    const users = this.getAllUsers();
    
    if (users.length === 0) {
      return '📋 No users have messaged the bot yet.';
    }

    let message = '👥 REGISTERED USERS\n\n';
    message += `Total Users: ${users.length}\n\n`;
    
    users.forEach((user, index) => {
      const lastSeen = new Date(user.last_seen).toLocaleString();
      const firstSeen = new Date(user.first_seen).toLocaleString();
      
      message += `${index + 1}. ${user.full_name || 'Unknown'}\n`;
      message += `   📋 User ID: ${user.user_id}\n`;
      if (user.username) {
        message += `   👤 Username: @${user.username}\n`;
      }
      message += `   💬 Messages: ${user.message_count}\n`;
      message += `   🕐 First Seen: ${firstSeen}\n`;
      message += `   🕐 Last Seen: ${lastSeen}\n`;
      message += `\n`;
    });

    message += `━━━━━━━━━━━━━━━━━━━\n`;
    message += `💡 To add support staff:\n`;
    message += `Update .env file with:\n`;
    message += `SUPPORT_STAFF_IDS=`;
    message += users.map(u => u.user_id).join(',');

    return message;
  }

  /**
   * Format user info for /whoami command
   * @param {string} userId - Telegram user ID
   * @returns {string} - Formatted message
   */
  formatUserInfo(userId) {
    const user = this.getUser(userId);
    
    if (!user) {
      return '❌ User not found in database.';
    }

    const permissionsManager = require('./permissionsManager');
    const role = permissionsManager.getUserRole(userId);
    const isSupportStaff = permissionsManager.isSupportStaff(userId);

    let message = '👤 YOUR INFORMATION\n\n';
    message += `Name: ${user.full_name || 'Unknown'}\n`;
    if (user.username) {
      message += `Username: @${user.username}\n`;
    }
    message += `\n📋 User ID: ${user.user_id}\n`;
    message += `💬 Chat ID: ${user.chat_id}\n`;
    message += `\n🔑 Role: ${role}\n`;
    
    if (isSupportStaff) {
      message += `✅ Support Staff Access Granted\n`;
      message += `   - Can create issues\n`;
      message += `   - Can update issue status\n`;
    } else {
      message += `   - Can create issues\n`;
      message += `   - Cannot update issue status\n`;
    }
    
    message += `\n📊 Statistics:\n`;
    message += `   Messages Sent: ${user.message_count}\n`;
    message += `   First Seen: ${new Date(user.first_seen).toLocaleString()}\n`;
    message += `   Last Seen: ${new Date(user.last_seen).toLocaleString()}\n`;

    return message;
  }

  /**
   * Export user IDs in .env format
   * @returns {string} - .env format string
   */
  exportForEnv() {
    const users = this.getAllUsers();
    const ids = users.map(u => u.user_id).join(',');
    return `SUPPORT_STAFF_IDS=${ids}`;
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      console.log('[UserIdLogger] Database connection closed');
    }
  }
}

// Export singleton instance
module.exports = new UserIdLogger();
