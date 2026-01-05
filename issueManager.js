/**
 * Issue Manager
 * Handles issue creation, storage, retrieval, and status updates
 * Uses SQLite for persistent storage
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { ISSUE_STATUS } = require('./constants');
const config = require('./config');

class IssueManager {
  constructor() {
    this.db = null;
    this.initDatabase();
  }

  /**
   * Initialize SQLite database and create tables if needed
   */
  initDatabase() {
    try {
      // Ensure data directory exists
      const dbDir = path.dirname(config.database.path);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Open database connection
      this.db = new Database(config.database.path);
      
      // Create issues table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS issues (
          issue_id TEXT PRIMARY KEY,
          employee_id TEXT NOT NULL,
          employee_name TEXT NOT NULL,
          department TEXT NOT NULL,
          category TEXT NOT NULL,
          urgency TEXT NOT NULL,
          description TEXT NOT NULL,
          contact_person TEXT,
          status TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          resolved_at DATETIME
        )
      `);

      // Create status history table for audit trail
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS status_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          issue_id TEXT NOT NULL,
          old_status TEXT,
          new_status TEXT NOT NULL,
          updated_by TEXT NOT NULL,
          updated_by_name TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (issue_id) REFERENCES issues(issue_id)
        )
      `);

      console.log('[IssueManager] Database initialized successfully');
    } catch (error) {
      console.error('[IssueManager] Database initialization error:', error);
      throw error;
    }
  }

  /**
   * Generate a unique Issue ID
   * Format: ISSUE-YYYYMMDD-XXXX (e.g., ISSUE-20260105-0001)
   * @returns {string} - Unique issue ID
   */
  generateIssueId() {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Get count of issues created today
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM issues 
      WHERE issue_id LIKE ?
    `);
    
    const result = stmt.get(`ISSUE-${dateStr}-%`);
    const count = result.count + 1;
    
    // Pad with zeros (0001, 0002, etc.)
    const sequence = count.toString().padStart(4, '0');
    
    return `ISSUE-${dateStr}-${sequence}`;
  }

  /**
   * Create a new issue
   * @param {object} issueData - Issue information
   * @returns {object} - Created issue with ID
   */
  createIssue(issueData) {
    const issueId = this.generateIssueId();
    
    const stmt = this.db.prepare(`
      INSERT INTO issues (
        issue_id, employee_id, employee_name, department, 
        category, urgency, description, contact_person, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      stmt.run(
        issueId,
        issueData.employeeId,
        issueData.employeeName,
        issueData.department,
        issueData.category,
        issueData.urgency,
        issueData.description,
        issueData.contactPerson || issueData.employeeName,
        ISSUE_STATUS.NEW
      );

      // Log initial status
      this.logStatusChange(issueId, null, ISSUE_STATUS.NEW, 'SYSTEM', 'System');

      console.log(`[IssueManager] Created issue: ${issueId}`);
      
      return {
        issueId,
        ...issueData,
        status: ISSUE_STATUS.NEW,
        createdAt: new Date(),
      };
    } catch (error) {
      console.error('[IssueManager] Error creating issue:', error);
      throw error;
    }
  }

  /**
   * Get issue by ID
   * @param {string} issueId - Issue ID
   * @returns {object|null} - Issue data or null
   */
  getIssue(issueId) {
    const stmt = this.db.prepare('SELECT * FROM issues WHERE issue_id = ?');
    const issue = stmt.get(issueId);
    return issue || null;
  }

  /**
   * Update issue status
   * @param {string} issueId - Issue ID
   * @param {string} newStatus - New status value
   * @param {string} updatedBy - User ID who updated
   * @param {string} updatedByName - Name of user who updated
   * @returns {boolean} - Success status
   */
  updateIssueStatus(issueId, newStatus, updatedBy, updatedByName) {
    const issue = this.getIssue(issueId);
    
    if (!issue) {
      console.error(`[IssueManager] Issue not found: ${issueId}`);
      return false;
    }

    const oldStatus = issue.status;
    
    // Don't update if status is the same
    if (oldStatus === newStatus) {
      console.log(`[IssueManager] Issue ${issueId} already has status ${newStatus}`);
      return true;
    }

    try {
      const stmt = this.db.prepare(`
        UPDATE issues 
        SET status = ?, 
            updated_at = CURRENT_TIMESTAMP,
            resolved_at = CASE WHEN ? = 'RESOLVED' THEN CURRENT_TIMESTAMP ELSE resolved_at END
        WHERE issue_id = ?
      `);

      stmt.run(newStatus, newStatus, issueId);

      // Log status change
      this.logStatusChange(issueId, oldStatus, newStatus, updatedBy, updatedByName);

      console.log(`[IssueManager] Updated ${issueId}: ${oldStatus} → ${newStatus}`);
      return true;
    } catch (error) {
      console.error('[IssueManager] Error updating issue status:', error);
      return false;
    }
  }

  /**
   * Log status change to history table
   * @param {string} issueId - Issue ID
   * @param {string} oldStatus - Previous status
   * @param {string} newStatus - New status
   * @param {string} updatedBy - User ID
   * @param {string} updatedByName - User name
   */
  logStatusChange(issueId, oldStatus, newStatus, updatedBy, updatedByName) {
    const stmt = this.db.prepare(`
      INSERT INTO status_history (issue_id, old_status, new_status, updated_by, updated_by_name)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(issueId, oldStatus, newStatus, updatedBy, updatedByName);
  }

  /**
   * Get all issues (with optional filters)
   * @param {object} filters - Filter criteria
   * @returns {array} - Array of issues
   */
  getAllIssues(filters = {}) {
    let query = 'SELECT * FROM issues WHERE 1=1';
    const params = [];

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.employeeId) {
      query += ' AND employee_id = ?';
      params.push(filters.employeeId);
    }

    if (filters.department) {
      query += ' AND department = ?';
      params.push(filters.department);
    }

    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  /**
   * Get status history for an issue
   * @param {string} issueId - Issue ID
   * @returns {array} - Status history records
   */
  getStatusHistory(issueId) {
    const stmt = this.db.prepare(`
      SELECT * FROM status_history 
      WHERE issue_id = ? 
      ORDER BY updated_at ASC
    `);
    
    return stmt.all(issueId);
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      console.log('[IssueManager] Database connection closed');
    }
  }
}

// Export singleton instance
module.exports = new IssueManager();
