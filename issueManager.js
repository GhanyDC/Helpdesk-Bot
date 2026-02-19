/**
 * Issue Manager
 * Handles issue creation, storage, retrieval, and status updates
 * Uses PostgreSQL via the shared db.js connection pool
 *
 * All public methods are async and use parameterized queries.
 */

const db = require('./db');
const logger = require('./logger');
const { ISSUE_STATUS } = require('./constants');

class IssueManager {
  /**
   * Generate a unique Issue ID
   * Format: ISSUE-YYYYMMDD-XXXX (e.g., ISSUE-20260105-0001)
   * @returns {Promise<string>} - Unique issue ID
   */
  async generateIssueId() {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    const result = await db.query(
      `SELECT COUNT(*) AS count FROM issues WHERE issue_id LIKE $1`,
      [`ISSUE-${dateStr}-%`]
    );

    const count = parseInt(result.rows[0].count, 10) + 1;
    const sequence = count.toString().padStart(4, '0');

    return `ISSUE-${dateStr}-${sequence}`;
  }

  /**
   * Create a new issue
   *
   * @param {object} issueData - Issue information (must include branch + department)
   * @returns {Promise<object>} - Created issue with ID
   */
  async createIssue(issueData) {
    const issueId = await this.generateIssueId();

    try {
      await db.query(
        `INSERT INTO issues (
          issue_id, employee_id, employee_name, branch, department,
          category, urgency, description, contact_person, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          issueId,
          issueData.employeeId,
          issueData.employeeName,
          issueData.branch,
          issueData.department,
          issueData.category,
          issueData.urgency,
          issueData.description,
          issueData.contactPerson || issueData.employeeName,
          ISSUE_STATUS.PENDING,
        ]
      );

      // Log initial status
      await this.logStatusChange(issueId, null, ISSUE_STATUS.PENDING, 'SYSTEM', 'System');

      logger.info(`[IssueManager] Created issue: ${issueId} (Branch: ${issueData.branch}, Dept: ${issueData.department})`);

      return {
        issueId,
        ...issueData,
        status: ISSUE_STATUS.PENDING,
        createdAt: new Date(),
      };
    } catch (error) {
      logger.error('[IssueManager] Error creating issue:', error);
      throw error;
    }
  }

  /**
   * Get issue by ID
   * @param {string} issueId - Issue ID
   * @returns {Promise<object|null>} - Issue data or null
   */
  async getIssue(issueId) {
    const result = await db.query(
      'SELECT * FROM issues WHERE issue_id = $1',
      [issueId]
    );
    return result.rows[0] || null;
  }

  /**
   * Update issue status
   * @param {string} issueId - Issue ID
   * @param {string} newStatus - New status value
   * @param {string} updatedBy - User ID who updated
   * @param {string} updatedByName - Name of user who updated
   * @returns {Promise<boolean>} - Success status
   */
  async updateIssueStatus(issueId, newStatus, updatedBy, updatedByName) {
    const issue = await this.getIssue(issueId);

    if (!issue) {
      logger.error(`[IssueManager] Issue not found: ${issueId}`);
      return false;
    }

    const oldStatus = issue.status;

    // Don't update if status is the same
    if (oldStatus === newStatus) {
      logger.info(`[IssueManager] Issue ${issueId} already has status ${newStatus}`);
      return true;
    }

    try {
      const shouldAssign = newStatus === 'in-process' && !issue.assigned_to;

      await db.query(
        `UPDATE issues
         SET status = $1,
             updated_at = CURRENT_TIMESTAMP,
             resolved_at = CASE WHEN $2 IN ('resolved', 'resolved-with-issues') THEN CURRENT_TIMESTAMP ELSE resolved_at END,
             assigned_to = CASE WHEN $3 THEN $4 ELSE assigned_to END,
             assigned_to_name = CASE WHEN $5 THEN $6 ELSE assigned_to_name END
         WHERE issue_id = $7`,
        [newStatus, newStatus, shouldAssign, updatedBy, shouldAssign, updatedByName, issueId]
      );

      // Log status change
      await this.logStatusChange(issueId, oldStatus, newStatus, updatedBy, updatedByName);

      logger.info(`[IssueManager] Updated ${issueId}: ${oldStatus} -> ${newStatus}`);
      return true;
    } catch (error) {
      logger.error('[IssueManager] Error updating issue status:', error);
      return false;
    }
  }

  /**
   * Log status change to history table
   */
  async logStatusChange(issueId, oldStatus, newStatus, updatedBy, updatedByName, remarks = null) {
    await db.query(
      `INSERT INTO status_history (issue_id, old_status, new_status, updated_by, updated_by_name, remarks)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [issueId, oldStatus, newStatus, updatedBy, updatedByName, remarks]
    );
  }

  /**
   * Add remarks to an issue and update status atomically
   */
  async resolveWithRemarks(issueId, newStatus, remarks, updatedBy, updatedByName) {
    const issue = await this.getIssue(issueId);
    if (!issue) return false;

    const oldStatus = issue.status;

    try {
      const shouldAssign = !issue.assigned_to;

      await db.query(
        `UPDATE issues
         SET status = $1, remarks = $2, updated_at = CURRENT_TIMESTAMP,
             resolved_at = CURRENT_TIMESTAMP,
             assigned_to = CASE WHEN $3 THEN $4 ELSE assigned_to END,
             assigned_to_name = CASE WHEN $5 THEN $6 ELSE assigned_to_name END
         WHERE issue_id = $7`,
        [newStatus, remarks, shouldAssign, updatedBy, shouldAssign, updatedByName, issueId]
      );

      await this.logStatusChange(issueId, oldStatus, newStatus, updatedBy, updatedByName, remarks);
      logger.info(`[IssueManager] Resolved ${issueId} with remarks: ${remarks.substring(0, 50)}...`);
      return true;
    } catch (error) {
      logger.error('[IssueManager] Error resolving with remarks:', error);
      return false;
    }
  }

  /**
   * Get all issues (with optional filters)
   * @param {object} filters - Filter criteria
   * @returns {Promise<array>} - Array of issues
   */
  async getAllIssues(filters = {}) {
    let query = 'SELECT * FROM issues WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (filters.status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(filters.status);
    }

    if (filters.employeeId) {
      query += ` AND employee_id = $${paramIndex++}`;
      params.push(filters.employeeId);
    }

    if (filters.department) {
      query += ` AND department = $${paramIndex++}`;
      params.push(filters.department);
    }

    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(filters.limit);
    }

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Get status history for an issue
   */
  async getStatusHistory(issueId) {
    const result = await db.query(
      `SELECT * FROM status_history WHERE issue_id = $1 ORDER BY updated_at ASC`,
      [issueId]
    );
    return result.rows;
  }

  /**
   * Get resolved tickets that haven't been confirmed
   * and were last updated more than daysOld days ago.
   */
  async getUnconfirmedResolvedIssues(daysOld) {
    try {
      const result = await db.query(
        `SELECT * FROM issues
         WHERE status IN ('resolved', 'resolved-with-issues')
           AND updated_at <= CURRENT_TIMESTAMP - make_interval(days => $1)`,
        [daysOld]
      );
      return result.rows;
    } catch (error) {
      logger.error('[IssueManager] Error getting unconfirmed resolved issues:', error);
      return [];
    }
  }

  /**
   * Get staff performance statistics for the last N days
   */
  async getWeeklyStaffStats(days = 7) {
    try {
      const result = await db.query(
        `SELECT
           updated_by_name,
           updated_by,
           COUNT(*)::int AS total_actions,
           SUM(CASE WHEN new_status IN ('resolved', 'resolved-with-issues') THEN 1 ELSE 0 END)::int AS resolved,
           SUM(CASE WHEN new_status = 'confirmed' THEN 1 ELSE 0 END)::int AS confirmed,
           SUM(CASE WHEN new_status = 'in-process' THEN 1 ELSE 0 END)::int AS in_process,
           SUM(CASE WHEN new_status IN ('cancelled-staff') THEN 1 ELSE 0 END)::int AS cancelled
         FROM status_history
         WHERE updated_at >= CURRENT_TIMESTAMP - make_interval(days => $1)
           AND updated_by != 'SYSTEM'
         GROUP BY updated_by, updated_by_name
         ORDER BY resolved DESC, total_actions DESC`,
        [days]
      );
      return result.rows;
    } catch (error) {
      logger.error('[IssueManager] Error getting weekly staff stats:', error);
      return [];
    }
  }

  /**
   * Get weekly issue statistics (overall) for the last N days
   */
  async getWeeklyIssueStats(days = 7) {
    try {
      const allIssues = await this.getAllIssues({});

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffStr = cutoffDate.toISOString();

      const weekIssues = allIssues.filter(issue => {
        const issueDate = issue.created_at instanceof Date
          ? issue.created_at.toISOString()
          : issue.created_at;
        return issueDate >= cutoffStr;
      });

      const total = weekIssues.length;
      const resolved = weekIssues.filter(i => ['resolved', 'resolved-with-issues', 'confirmed', 'closed'].includes(i.status)).length;
      const cancelled = weekIssues.filter(i => ['cancelled-staff', 'cancelled-user'].includes(i.status)).length;
      const open = weekIssues.filter(i => !['resolved', 'resolved-with-issues', 'confirmed', 'closed', 'cancelled-staff', 'cancelled-user'].includes(i.status)).length;
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
      logger.error('[IssueManager] Error getting weekly issue stats:', error);
      return { totalCreated: 0, totalResolved: 0, totalCancelled: 0, totalOpenThisWeek: 0, totalOpenOverall: 0, resolutionRate: 0 };
    }
  }

  /**
   * Get weekly stats broken down by branch
   */
  async getWeeklyBranchStats(days = 7) {
    try {
      const allIssues = await this.getAllIssues({});

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffStr = cutoffDate.toISOString();

      const weekIssues = allIssues.filter(issue => {
        const issueDate = issue.created_at instanceof Date
          ? issue.created_at.toISOString()
          : issue.created_at;
        return issueDate >= cutoffStr;
      });

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
      logger.error('[IssueManager] Error getting weekly branch stats:', error);
      return [];
    }
  }

  /**
   * Close database pool (delegates to db.js)
   */
  async close() {
    await db.close();
  }
}

// Export singleton instance
module.exports = new IssueManager();
