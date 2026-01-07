/**
 * Routing Service
 * 
 * BRANCH-BASED TICKET ROUTING (CORRECTED)
 * 
 * Purpose:
 * Routes issues to appropriate support groups based on BRANCH (not department).
 * 
 * IMPORTANT DISTINCTION:
 * - BRANCH (JHQ, CHQ, GS) = Company location → ROUTING KEY
 * - DEPARTMENT (Accounting, HR, Sales, etc.) = Functional division → METADATA ONLY
 * 
 * Why This Exists:
 * - Each branch has its own support team
 * - Support groups are organized by branch, not by department
 * - Department info is captured for context but doesn't affect routing
 * 
 * Routing Strategy:
 * 1. Read issue.branch (JHQ/CHQ/GS)
 * 2. Route to corresponding SUPPORT_GROUP_<BRANCH>
 * 3. Falls back to SUPPORT_GROUP_ID if branch group not configured
 * 4. Optionally forwards visibility copy to central monitoring
 * 
 * Department Representatives:
 * - Included in their BRANCH support group (not department-specific groups)
 * - See all issues from their branch, filtered by department in the message
 * - Can provide context but cannot update status (unless in SUPPORT_STAFF_IDS)
 * 
 * Author: Tech Solutions Inc.
 * Date: January 2026 (Corrected)
 */

const config = require('./config');
const messagingAdapter = require('./messagingAdapter');
const issueManager = require('./issueManager');

class RoutingService {
  constructor() {
    this.branchGroups = config.support.branchGroups || {};
    this.centralMonitoringGroup = config.support.centralMonitoringGroup;
    this.enableCentralMonitoring = config.support.enableCentralMonitoring;
    this.fallbackGroupId = config.support.groupId;

    console.log('[RoutingService] Initialized');
    console.log(`[RoutingService] Branch groups configured: ${Object.keys(this.branchGroups).length}`);
    console.log(`[RoutingService] Central monitoring: ${this.enableCentralMonitoring ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Route an issue to appropriate support groups
   * 
   * CORRECTED Routing Logic:
   * 1. Determine target branch group based on BRANCH (not department)
   * 2. Send ACTION message to branch group (support staff can respond)
   * 3. Send VISIBILITY message to central monitoring (read-only)
   * 
   * @param {object} issue - Issue object with branch, department, urgency, etc.
   */
  async routeIssue(issue) {
    console.log(`[RoutingService] Routing issue ${issue.issueId} (Branch: ${issue.branch}, Department: ${issue.department})`);

    // Primary Route: Branch-specific action group
    await this.sendToActionGroup(issue);

    // Secondary Route: Central monitoring (if enabled)
    await this.sendToMonitoringGroup(issue);
  }

  /**
   * Send issue to the BRANCH-specific action group
   * This group can take action (ACK, ONGOING, RESOLVED)
   * 
   * CORRECTED: Uses issue.branch (JHQ/CHQ/GS), NOT issue.department
   * 
   * @param {object} issue - Issue object
   */
  async sendToActionGroup(issue) {
    const branch = issue.branch;  // CORRECTED: Use BRANCH for routing
    let targetGroup = null;

    // Try to find branch-specific group
    if (this.branchGroups[branch]) {
      targetGroup = this.branchGroups[branch];
      console.log(`[RoutingService] Found branch group for ${branch}: ${targetGroup}`);
    } else {
      // Fallback to legacy single group
      targetGroup = this.fallbackGroupId;
      console.log(`[RoutingService] No branch group for ${branch}, using fallback: ${targetGroup}`);
    }

    if (!targetGroup) {
      console.error(`[RoutingService] No support group configured for branch ${branch} and no fallback group`);
      return;
    }

    // Format and send action message
    const message = this.formatActionMessage(issue);
    await messagingAdapter.sendGroupMessage(targetGroup, message);

    console.log(`[RoutingService] Sent action message to ${branch} branch group ${targetGroup}`);
  }

  /**
   * Send visibility copy to central monitoring group
   * This is read-only - for management oversight, not action
   * 
   * @param {object} issue - Issue object
   */
  async sendToMonitoringGroup(issue) {
    // Check if central monitoring is enabled
    if (!this.enableCentralMonitoring) {
      console.log('[RoutingService] Central monitoring disabled, skipping');
      return;
    }

    if (!this.centralMonitoringGroup) {
      console.log('[RoutingService] Central monitoring enabled but group not configured');
      return;
    }

    // Format monitoring message with additional context
    const message = this.formatMonitoringMessage(issue);
    await messagingAdapter.sendGroupMessage(this.centralMonitoringGroup, message);

    console.log(`[RoutingService] Sent monitoring copy to ${this.centralMonitoringGroup}`);
  }

  /**
   * Format issue as ACTION message for branch support group
   * Support staff in this group can update status
   * 
   * Shows both branch (routing info) and department (context)
   * 
   * @param {object} issue - Issue object
   * @returns {string} - Formatted message
   */
  formatActionMessage(issue) {
    return `
🆕 NEW HELPDESK ISSUE

📋 Issue ID: ${issue.issueId}
🏢 Branch: ${issue.branch}
📂 Department: ${issue.department}
👤 Employee: ${issue.employeeName}
🔧 Category: ${issue.category}
⚠️ Urgency: ${issue.urgency}
📞 Contact: ${issue.contactPerson}

📝 Description:
${issue.description}

Status: ${issue.status}
Created: ${new Date(issue.createdAt).toLocaleString()}

━━━━━━━━━━━━━━━━━━━
To update status, reply:
ACK ${issue.issueId}
ONGOING ${issue.issueId}
RESOLVED ${issue.issueId}
    `.trim();
  }

  /**
   * Format issue as MONITORING message for central group
   * Includes additional context and metrics for management visibility
   * Clearly labeled as read-only
   * 
   * Shows branch (routing) and department (context)
   * 
   * @param {object} issue - Issue object
   * @returns {string} - Formatted message with monitoring context
   */
  formatMonitoringMessage(issue) {
    // Get today's metrics for this branch
    const todayStats = this.getBranchStatsToday(issue.branch);

    return `
[📊 MONITORING COPY - Read Only]

🆕 NEW ISSUE - ${issue.branch} Branch

📋 Issue ID: ${issue.issueId}
📂 Department: ${issue.department}
⚠️ Urgency: ${issue.urgency}
🔧 Category: ${issue.category}
👤 Employee: ${issue.employeeName}

📝 Description:
${issue.description.substring(0, 200)}${issue.description.length > 200 ? '...' : ''}

━━━━━━━━━━━━━━━━━━━
📊 ${issue.branch} Branch Today:
├─ Total Issues: ${todayStats.total}
├─ Open Issues: ${todayStats.open}
└─ Resolved Today: ${todayStats.resolved}

Created: ${new Date(issue.createdAt).toLocaleString()}
    `.trim();
  }

  /**
   * Get statistics for a BRANCH today (CORRECTED)
   * Used to provide context in monitoring messages
   * 
   * @param {string} branch - Branch name (JHQ/CHQ/GS)
   * @returns {object} - Stats object {total, open, resolved}
   */
  getBranchStatsToday(branch) {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // Get all issues for this BRANCH today
      const allIssues = issueManager.getAllIssues({});

      // Filter by branch and today's date
      const todayIssues = allIssues.filter(issue => {
        const issueDate = issue.created_at.split(' ')[0];
        // Note: Database may not have branch field yet - handle gracefully
        const issueBranch = issue.branch || null;
        return issueDate === today && issueBranch === branch;
      });

      // Calculate stats
      const total = todayIssues.length;
      const resolved = todayIssues.filter(i => i.status === 'RESOLVED').length;
      const open = todayIssues.filter(i => i.status !== 'RESOLVED').length;

      return { total, open, resolved };
    } catch (error) {
      console.error('[RoutingService] Error calculating branch stats:', error);
      return { total: 0, open: 0, resolved: 0 };
    }
  }

  /**
   * Send status update notification to all relevant parties
   * 
   * @param {object} issue - Issue object
   * @param {string} oldStatus - Previous status
   * @param {string} newStatus - New status
   * @param {string} updatedBy - Name of person who updated
   */
  async notifyStatusUpdate(issue, oldStatus, newStatus, updatedBy) {
    // Notify the employee who created the issue
    await messagingAdapter.notifyStatusUpdate(
      issue.employee_id,
      issue.issue_id,
      oldStatus,
      newStatus,
      updatedBy
    );

    // Notify central monitoring (if enabled)
    if (this.enableCentralMonitoring && this.centralMonitoringGroup) {
      let updateMessage = '';
      
      // For RESOLVED status, send detailed branch metrics
      if (newStatus === 'RESOLVED') {
        const branchStats = this.getBranchStatsToday(issue.branch);
        const yesterdayStats = this.getBranchStatsYesterday(issue.branch);
        const avgResponseTime = this.getAverageResponseTime(issue.branch);
        
        updateMessage = `
[📊 CENTRAL MONITORING - Read Only]

✅ ISSUE RESOLVED

📋 Issue: ${issue.issue_id}
🏢 Branch: ${issue.branch}
📂 Department: ${issue.department}
⚠️ Urgency: ${issue.urgency}
👤 Resolved by: ${updatedBy}
⏰ ${new Date().toLocaleString()}

━━━━━━━━━━━━━━━━━━━
📊 ${issue.branch} BRANCH METRICS TODAY:
├─ Total Issues: ${branchStats.total} (${this.getChangeIndicator(branchStats.total, yesterdayStats.total)} from yesterday: ${yesterdayStats.total})
├─ Open Issues: ${branchStats.open}
├─ Resolved Today: ${branchStats.resolved}
└─ Avg Response Time: ${avgResponseTime}
        `.trim();
      } else {
        // For other status updates, send simple notification
        updateMessage = `
[📊 CENTRAL MONITORING - Read Only]

📊 STATUS UPDATE

📋 Issue: ${issue.issue_id}
🏢 Branch: ${issue.branch}
📂 Department: ${issue.department}
⚠️ Urgency: ${issue.urgency}
📊 Status: ${oldStatus} → ${newStatus}
👤 Updated by: ${updatedBy}
⏰ ${new Date().toLocaleString()}
        `.trim();
      }

      await messagingAdapter.sendGroupMessage(this.centralMonitoringGroup, updateMessage);
    }
  }

  /**
   * Get change indicator for metrics comparison
   * @param {number} current - Current value
   * @param {number} previous - Previous value
   * @returns {string} - Arrow indicator
   */
  getChangeIndicator(current, previous) {
    if (current > previous) return '↑';
    if (current < previous) return '↓';
    return '→';
  }

  /**
   * Get branch statistics for yesterday
   * @param {string} branch - Branch name
   * @returns {object} - Yesterday's stats
   */
  getBranchStatsYesterday(branch) {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const allIssues = issueManager.getAllIssues({});
      const yesterdayIssues = allIssues.filter(issue => {
        const issueDate = issue.created_at.split(' ')[0];
        const issueBranch = issue.branch || null;
        return issueDate === yesterdayStr && issueBranch === branch;
      });

      const total = yesterdayIssues.length;
      const resolved = yesterdayIssues.filter(i => i.status === 'RESOLVED').length;
      const open = yesterdayIssues.filter(i => i.status !== 'RESOLVED').length;

      return { total, open, resolved };
    } catch (error) {
      console.error('[RoutingService] Error calculating yesterday stats:', error);
      return { total: 0, open: 0, resolved: 0 };
    }
  }

  /**
   * Calculate average response time for a branch today
   * Response time = time from creation to first status change
   * @param {string} branch - Branch name
   * @returns {string} - Formatted average time
   */
  getAverageResponseTime(branch) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const allIssues = issueManager.getAllIssues({});
      
      const todayIssues = allIssues.filter(issue => {
        const issueDate = issue.created_at.split(' ')[0];
        const issueBranch = issue.branch || null;
        return issueDate === today && issueBranch === branch && issue.status !== 'NEW';
      });

      if (todayIssues.length === 0) {
        return 'N/A';
      }

      // Calculate response times
      let totalMinutes = 0;
      let count = 0;

      todayIssues.forEach(issue => {
        const history = issueManager.getIssueHistory(issue.issue_id);
        if (history && history.length > 0) {
          // First status change
          const firstChange = history[0];
          const created = new Date(issue.created_at);
          const responded = new Date(firstChange.changed_at);
          const diffMs = responded - created;
          const diffMins = Math.floor(diffMs / 60000);
          
          if (diffMins >= 0) {
            totalMinutes += diffMins;
            count++;
          }
        }
      });

      if (count === 0) {
        return 'N/A';
      }

      const avgMinutes = Math.round(totalMinutes / count);
      
      if (avgMinutes < 60) {
        return `${avgMinutes} mins`;
      } else {
        const hours = Math.floor(avgMinutes / 60);
        const mins = avgMinutes % 60;
        return `${hours}h ${mins}m`;
      }
    } catch (error) {
      console.error('[RoutingService] Error calculating avg response time:', error);
      return 'N/A';
    }
  }
}

// Export singleton instance
module.exports = new RoutingService();
