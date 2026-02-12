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
          branch TEXT NOT NULL,
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

      // Migration: Add branch column if it doesn't exist (for existing databases)
      try {
        this.db.exec(`ALTER TABLE issues ADD COLUMN branch TEXT`);
        console.log('[IssueManager] Added branch column to existing database');
      } catch (error) {
        if (!error.message.includes('duplicate column name')) {
          console.warn('[IssueManager] Branch column migration note:', error.message);
        }
      }

      // Migration: Add remarks column
      try {
        this.db.exec(`ALTER TABLE issues ADD COLUMN remarks TEXT`);
        console.log('[IssueManager] Added remarks column to existing database');
      } catch (error) {
        if (!error.message.includes('duplicate column name')) {
          console.warn('[IssueManager] Remarks column migration note:', error.message);
        }
      }

      // Migration: Add assigned_to column for ticket ownership
      try {
        this.db.exec(`ALTER TABLE issues ADD COLUMN assigned_to TEXT`);
        console.log('[IssueManager] Added assigned_to column to existing database');
      } catch (error) {
        if (!error.message.includes('duplicate column name')) {
          console.warn('[IssueManager] assigned_to column migration note:', error.message);
        }
      }

      // Migration: Add assigned_to_name column for ticket ownership
      try {
        this.db.exec(`ALTER TABLE issues ADD COLUMN assigned_to_name TEXT`);
        console.log('[IssueManager] Added assigned_to_name column to existing database');
      } catch (error) {
        if (!error.message.includes('duplicate column name')) {
          console.warn('[IssueManager] assigned_to_name column migration note:', error.message);
        }
      }

      // Create status history table for audit trail
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS status_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          issue_id TEXT NOT NULL,
          old_status TEXT,
          new_status TEXT NOT NULL,
          updated_by TEXT NOT NULL,
          updated_by_name TEXT,
          remarks TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (issue_id) REFERENCES issues(issue_id)
        )
      `);

      // Migration: Add remarks column to status_history if missing (for existing databases)
      try {
        this.db.exec(`ALTER TABLE status_history ADD COLUMN remarks TEXT`);
        console.log('[IssueManager] Added remarks column to status_history table');
      } catch (error) {
        if (!error.message.includes('duplicate column name')) {
          console.warn('[IssueManager] status_history remarks migration note:', error.message);
        }
      }

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
   * 
   * IMPORTANT: Requires both branch (routing) and department (context)
   * - branch: JHQ/TRK/GS/IPIL → determines which support group receives the issue
   * - department: Accounting/Sales/HR/etc → stored as metadata for context
   * 
   * @param {object} issueData - Issue information (must include branch + department)
   * @returns {object} - Created issue with ID
   */
  createIssue(issueData) {
    const issueId = this.generateIssueId();
    
    const stmt = this.db.prepare(`
      INSERT INTO issues (
        issue_id, employee_id, employee_name, branch, department, 
        category, urgency, description, contact_person, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      stmt.run(
        issueId,
        issueData.employeeId,
        issueData.employeeName,
        issueData.branch,          // ROUTING KEY
        issueData.department,      // METADATA
        issueData.category,
        issueData.urgency,
        issueData.description,
        issueData.contactPerson || issueData.employeeName,
        ISSUE_STATUS.PENDING
      );

      // Log initial status
      this.logStatusChange(issueId, null, ISSUE_STATUS.PENDING, 'SYSTEM', 'System');

      console.log(`[IssueManager] Created issue: ${issueId} (Branch: ${issueData.branch}, Dept: ${issueData.department})`);
      
      return {
        issueId,
        ...issueData,
        status: ISSUE_STATUS.PENDING,
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
      // Assign ticket to staff when moving to in-process
      const shouldAssign = (newStatus === 'in-process' && !issue.assigned_to) ? 1 : 0;
      
      const stmt = this.db.prepare(`
        UPDATE issues 
        SET status = ?, 
            updated_at = CURRENT_TIMESTAMP,
            resolved_at = CASE WHEN ? IN ('resolved', 'resolved-with-issues') THEN CURRENT_TIMESTAMP ELSE resolved_at END,
            assigned_to = CASE WHEN ? THEN ? ELSE assigned_to END,
            assigned_to_name = CASE WHEN ? THEN ? ELSE assigned_to_name END
        WHERE issue_id = ?
      `);

      stmt.run(newStatus, newStatus, shouldAssign, updatedBy, shouldAssign, updatedByName, issueId);

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
   * @param {string} remarks - Optional remarks from support staff
   */
  logStatusChange(issueId, oldStatus, newStatus, updatedBy, updatedByName, remarks = null) {
    const stmt = this.db.prepare(`
      INSERT INTO status_history (issue_id, old_status, new_status, updated_by, updated_by_name, remarks)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(issueId, oldStatus, newStatus, updatedBy, updatedByName, remarks);
  }

  /**
   * Add remarks to an issue and update status atomically
   * Used when support resolves an issue with mandatory remarks
   * @param {string} issueId - Issue ID
   * @param {string} newStatus - New status value
   * @param {string} remarks - Support staff remarks
   * @param {string} updatedBy - User ID
   * @param {string} updatedByName - User name
   * @returns {boolean}
   */
  resolveWithRemarks(issueId, newStatus, remarks, updatedBy, updatedByName) {
    const issue = this.getIssue(issueId);
    if (!issue) return false;

    const oldStatus = issue.status;

    try {
      // Assign ticket to staff if not already assigned
      const shouldAssign = !issue.assigned_to ? 1 : 0;
      
      const updateStmt = this.db.prepare(`
        UPDATE issues 
        SET status = ?, remarks = ?, updated_at = CURRENT_TIMESTAMP,
            resolved_at = CURRENT_TIMESTAMP,
            assigned_to = CASE WHEN ? THEN ? ELSE assigned_to END,
            assigned_to_name = CASE WHEN ? THEN ? ELSE assigned_to_name END
        WHERE issue_id = ?
      `);
      updateStmt.run(newStatus, remarks, shouldAssign, updatedBy, shouldAssign, updatedByName, issueId);

      this.logStatusChange(issueId, oldStatus, newStatus, updatedBy, updatedByName, remarks);
      console.log(`[IssueManager] Resolved ${issueId} with remarks: ${remarks.substring(0, 50)}...`);
      return true;
    } catch (error) {
      console.error('[IssueManager] Error resolving with remarks:', error);
      return false;
    }
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
   * Get resolved/resolved-with-issues tickets that haven't been confirmed
   * and were last updated more than `daysOld` days ago.
   * Used by the auto-close scheduler.
   * 
   * @param {number} daysOld - Number of days since last status update
   * @returns {array} - Array of issues eligible for auto-confirmation
   */
  getUnconfirmedResolvedIssues(daysOld) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      const cutoffStr = cutoffDate.toISOString().replace('T', ' ').slice(0, 19);

      const stmt = this.db.prepare(`
        SELECT * FROM issues 
        WHERE status IN ('resolved', 'resolved-with-issues')
        AND updated_at <= ?
      `);

      return stmt.all(cutoffStr);
    } catch (error) {
      console.error('[IssueManager] Error getting unconfirmed resolved issues:', error);
      return [];
    }
  }

  /**
   * Get staff performance statistics for the last N days
   * Queries status_history grouped by updated_by_name
   * 
   * @param {number} days - Number of days to look back (default: 7)
   * @returns {array} - Array of { staff_name, staff_id, resolved, cancelled, in_process, total_actions }
   */
  getWeeklyStaffStats(days = 7) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffStr = cutoffDate.toISOString().replace('T', ' ').slice(0, 19);

      const stmt = this.db.prepare(`
        SELECT 
          updated_by_name,
          updated_by,
          COUNT(*) as total_actions,
          SUM(CASE WHEN new_status IN ('resolved', 'resolved-with-issues') THEN 1 ELSE 0 END) as resolved,
          SUM(CASE WHEN new_status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
          SUM(CASE WHEN new_status = 'in-process' THEN 1 ELSE 0 END) as in_process,
          SUM(CASE WHEN new_status IN ('cancelled-staff') THEN 1 ELSE 0 END) as cancelled
        FROM status_history
        WHERE updated_at >= ?
          AND updated_by != 'SYSTEM'
        GROUP BY updated_by
        ORDER BY resolved DESC, total_actions DESC
      `);

      return stmt.all(cutoffStr);
    } catch (error) {
      console.error('[IssueManager] Error getting weekly staff stats:', error);
      return [];
    }
  }

  /**
   * Get weekly issue statistics (overall) for the last N days
   * 
   * @param {number} days - Number of days to look back
   * @returns {object} - { total_created, total_resolved, total_confirmed, total_cancelled, total_open }
   */
  getWeeklyIssueStats(days = 7) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffStr = cutoffDate.toISOString().replace('T', ' ').slice(0, 19);

      const allIssues = this.getAllIssues({});
      const weekIssues = allIssues.filter(issue => issue.created_at >= cutoffStr);

      const total = weekIssues.length;
      const resolved = weekIssues.filter(i => ['resolved', 'resolved-with-issues', 'confirmed', 'closed'].includes(i.status)).length;
      const cancelled = weekIssues.filter(i => ['cancelled-staff', 'cancelled-user'].includes(i.status)).length;
      const open = weekIssues.filter(i => !['resolved', 'resolved-with-issues', 'confirmed', 'closed', 'cancelled-staff', 'cancelled-user'].includes(i.status)).length;

      // Also count all currently open issues (regardless of creation date)
      const allOpen = allIssues.filter(i => !['resolved', 'resolved-with-issues', 'confirmed', 'closed', 'cancelled-staff', 'cancelled-user'].includes(i.status)).length;

      return {
        totalCreated: total,
        totalResolved: resolved,
        totalCancelled: cancelled,
        totalOpenThisWeek: open,
        totalOpenOverall: allOpen,
        resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
      };
    } catch (error) {
      console.error('[IssueManager] Error getting weekly issue stats:', error);
      return { totalCreated: 0, totalResolved: 0, totalCancelled: 0, totalOpenThisWeek: 0, totalOpenOverall: 0, resolutionRate: 0 };
    }
  }

  /**
   * Get weekly stats broken down by branch
   * 
   * @param {number} days - Number of days to look back
   * @returns {array} - Array of { branch, total, resolved, open, cancelled }
   */
  getWeeklyBranchStats(days = 7) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffStr = cutoffDate.toISOString().replace('T', ' ').slice(0, 19);

      const allIssues = this.getAllIssues({});
      const weekIssues = allIssues.filter(issue => issue.created_at >= cutoffStr);

      const branchMap = {};
      weekIssues.forEach(issue => {
        const branch = issue.branch || 'Unknown';
        if (!branchMap[branch]) {
          branchMap[branch] = { branch, total: 0, resolved: 0, open: 0, cancelled: 0 };
        }
        branchMap[branch].total++;
        if (['resolved', 'resolved-with-issues', 'confirmed', 'closed'].includes(issue.status)) {
          branchMap[branch].resolved++;
        } else if (['cancelled-staff', 'cancelled-user'].includes(issue.status)) {
          branchMap[branch].cancelled++;
        } else {
          branchMap[branch].open++;
        }
      });

      return Object.values(branchMap).sort((a, b) => b.total - a.total);
    } catch (error) {
      console.error('[IssueManager] Error getting weekly branch stats:', error);
      return [];
    }
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
