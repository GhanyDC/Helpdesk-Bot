/**
 * User ID Logger — Role-Based User Registry
 *
 * Stores user info in the PostgreSQL users table.
 * Supports role-based lookups (employee / support / admin).
 * Seeds initial roles from SUPPORT_STAFF_IDS env on boot.
 */

const db = require('./db');
const logger = require('./logger');

class UserIdLogger {
  /**
   * Log / upsert a user interaction.
   * Preserves existing role if the user already exists.
   */
  async logUser(userInfo) {
    try {
      const { id, username, first_name, last_name, chat_id } = userInfo;
      const fullName = [first_name, last_name].filter(Boolean).join(' ');

      const result = await db.query(
        `INSERT INTO users (telegram_id, username, first_name, last_name, full_name, chat_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (telegram_id) DO UPDATE SET
           username = EXCLUDED.username,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           full_name = EXCLUDED.full_name,
           chat_id = EXCLUDED.chat_id,
           last_seen = CURRENT_TIMESTAMP,
           message_count = users.message_count + 1
         RETURNING (xmax = 0) AS is_new`,
        [id.toString(), username || null, first_name || null, last_name || null, fullName, chat_id.toString()]
      );

      if (result.rows[0] && result.rows[0].is_new) {
        logger.info('New user detected', { userId: id, fullName, username });
      }
    } catch (error) {
      logger.error('Error logging user', { error: error.message });
    }
  }

  /**
   * Seed roles from SUPPORT_STAFF_IDS env variable.
   * Called once at boot so that env-defined staff get the 'support' role.
   */
  async seedRolesFromEnv() {
    const config = require('./config');
    const staffIds = config.auth.supportStaffIds || [];
    for (const id of staffIds) {
      await db.query(
        `INSERT INTO users (telegram_id, role)
         VALUES ($1, 'support')
         ON CONFLICT (telegram_id) DO UPDATE SET role = 'support'`,
        [id]
      );
    }
    if (staffIds.length > 0) {
      logger.info(`Seeded ${staffIds.length} support staff roles from env`);
    }
  }

  /**
   * Get user role from DB.
   */
  async getUserRole(userId) {
    const result = await db.query('SELECT role FROM users WHERE telegram_id = $1', [userId]);
    return result.rows[0] ? result.rows[0].role : 'employee';
  }

  async getAllUsers() {
    try {
      const result = await db.query('SELECT * FROM users ORDER BY last_seen DESC');
      return result.rows;
    } catch (error) {
      logger.error('Error getting users', { error: error.message });
      return [];
    }
  }

  async getUser(userId) {
    try {
      const result = await db.query('SELECT * FROM users WHERE telegram_id = $1', [userId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error getting user', { error: error.message });
      return null;
    }
  }

  async formatUserList() {
    const users = await this.getAllUsers();
    if (users.length === 0) return 'No users have messaged the bot yet.';

    let message = 'REGISTERED USERS\n\n';
    message += `Total Users: ${users.length}\n\n`;

    users.forEach((user, index) => {
      const lastSeen = new Date(user.last_seen).toLocaleString();
      const firstSeen = new Date(user.first_seen).toLocaleString();
      message += `${index + 1}. ${user.full_name || 'Unknown'} [${user.role}]\n`;
      message += `   User ID: ${user.telegram_id}\n`;
      if (user.username) message += `   Username: @${user.username}\n`;
      message += `   Messages: ${user.message_count}\n`;
      message += `   First Seen: ${firstSeen}\n`;
      message += `   Last Seen: ${lastSeen}\n\n`;
    });

    return message;
  }

  async formatUserInfo(userId) {
    const user = await this.getUser(userId);
    if (!user) return 'User not found in database.';

    const permissionsManager = require('./permissionsManager');
    const role = user.role || permissionsManager.getUserRole(userId);
    const isSupportStaff = permissionsManager.isSupportStaff(userId);

    let message = 'YOUR INFORMATION\n\n';
    message += `Name: ${user.full_name || 'Unknown'}\n`;
    if (user.username) message += `Username: @${user.username}\n`;
    message += `\nUser ID: ${user.telegram_id}\n`;
    message += `Chat ID: ${user.chat_id}\n`;
    message += `\nRole: ${role}\n`;

    if (isSupportStaff) {
      message += 'Support Staff Access Granted\n';
      message += '   - Can create issues\n';
      message += '   - Can update issue status\n';
    } else {
      message += '   - Can create issues\n';
      message += '   - Cannot update issue status\n';
    }

    message += `\nStatistics:\n`;
    message += `   Messages Sent: ${user.message_count}\n`;
    message += `   First Seen: ${new Date(user.first_seen).toLocaleString()}\n`;
    message += `   Last Seen: ${new Date(user.last_seen).toLocaleString()}\n`;

    return message;
  }

  async exportForEnv() {
    const users = await this.getAllUsers();
    const ids = users.map((u) => u.telegram_id).join(',');
    return `SUPPORT_STAFF_IDS=${ids}`;
  }

  async close() {
    logger.info('UserIdLogger close called (pool managed by db.js)');
  }
}

module.exports = new UserIdLogger();
