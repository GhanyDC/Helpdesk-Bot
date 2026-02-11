/**
 * Statistics Service
 * 
 * OPERATIONAL METRICS & REPORTING
 * 
 * Purpose:
 * Provides on-demand statistics and metrics for helpdesk operations.
 * Focuses on actionable insights without overwhelming users with data.
 * 
 * Why This Exists:
 * - Support staff need quick visibility into workload
 * - Management needs daily operational summaries
 * - Avoid performance tracking (focus on workload, not individuals)
 * - Keep it lightweight (no complex analytics or dashboards)
 * 
 * Design Principles:
 * - Simple SQL queries (no heavy analytics engine)
 * - Bot commands for ad-hoc queries (/stats, /open_issues)
 * - Daily summaries sent automatically
 * - No SLA enforcement (informational only)
 * 
 * Author: Tech Solutions Inc.
 * Date: January 2026
 */

const issueManager = require('./issueManager');
const { BRANCHES, TERMINAL_STATUSES } = require('./constants');

// Helper: check if a status counts as "resolved/closed" for stats
function isClosedStatus(status) {
  return ['resolved', 'resolved-with-issues', 'confirmed', 'closed', 'cancelled-staff', 'cancelled-user'].includes(status);
}

// Helper: check if a status counts as "open" for stats
function isOpenStatus(status) {
  return !isClosedStatus(status);
}

class StatsService {
  /**
   * Get overall statistics for today
   * @returns {object} - Today's statistics
   */
  getTodayStats() {
    const today = this.getTodayDateString();
    const allIssues = issueManager.getAllIssues({});
    
    // Filter issues created today
    const todayIssues = allIssues.filter(issue => {
      const issueDate = issue.created_at.split(' ')[0];
      return issueDate === today;
    });

    const total = todayIssues.length;
    const resolved = todayIssues.filter(i => i.status === 'resolved' || i.status === 'resolved-with-issues').length;
    const confirmed = todayIssues.filter(i => i.status === 'confirmed').length;
    const cancelled = todayIssues.filter(i => i.status === 'cancelled-staff' || i.status === 'cancelled-user').length;
    const closed = todayIssues.filter(i => i.status === 'closed').length; // legacy
    const inProgress = todayIssues.filter(i => i.status === 'in-process').length;
    const pending = todayIssues.filter(i => i.status === 'pending').length;
    const open = todayIssues.filter(i => isOpenStatus(i.status)).length;
    const totalResolved = resolved + confirmed + closed;

    return {
      date: today,
      total,
      pending,
      inProgress,
      resolved: totalResolved,
      cancelled,
      closed,
      open,
      resolutionRate: total > 0 ? Math.round((totalResolved / total) * 100) : 0,
    };
  }

  /**
   * Get statistics by BRANCH for today (CORRECTED)
   * @returns {array} - Array of branch stats
   */
  getBranchStatsToday() {
    const today = this.getTodayDateString();
    const branches = Object.values(BRANCHES);
    const stats = [];

    branches.forEach(branch => {
      const allIssues = issueManager.getAllIssues({});
      
      // Filter by branch and today
      const branchIssues = allIssues.filter(issue => {
        const issueDate = issue.created_at.split(' ')[0];
        const issueBranch = issue.branch || null;
        return issueDate === today && issueBranch === branch;
      });

      const total = branchIssues.length;
      const resolved = branchIssues.filter(i => isClosedStatus(i.status)).length;
      const open = branchIssues.filter(i => isOpenStatus(i.status)).length;

      if (total > 0) {
        stats.push({
          branch,
          total,
          open,
          resolved: resolved,
          resolutionRate: Math.round((resolved / total) * 100),
        });
      }
    });

    // Sort by total issues (descending)
    return stats.sort((a, b) => b.total - a.total);
  }

  /**
   * Get statistics by urgency for today
   * @returns {object} - Urgency breakdown
   */
  getUrgencyStatsToday() {
    const today = this.getTodayDateString();
    const allIssues = issueManager.getAllIssues({});
    
    const todayIssues = allIssues.filter(issue => {
      const issueDate = issue.created_at.split(' ')[0];
      return issueDate === today;
    });

    const urgencyLevels = ['Critical', 'High', 'Medium', 'Low'];
    const stats = {};

    urgencyLevels.forEach(level => {
      const issues = todayIssues.filter(i => i.urgency === level);
      const open = issues.filter(i => isOpenStatus(i.status)).length;
      
      stats[level] = {
        total: issues.length,
        open,
        resolved: issues.length - open,
      };
    });

    return stats;
  }

  /**
   * Get all open (unresolved) issues
   * @returns {array} - Open issues
   */
  getOpenIssues() {
    const allIssues = issueManager.getAllIssues({});
    return allIssues.filter(i => isOpenStatus(i.status));
  }

  /**
   * Get open issues count by BRANCH (CORRECTED)
   * @returns {array} - Branch open issues
   */
  getOpenIssuesByBranch() {
    const openIssues = this.getOpenIssues();
    const branches = Object.values(BRANCHES);
    const stats = [];

    branches.forEach(branch => {
      const branchOpenIssues = openIssues.filter(i => i.branch === branch);
      
      if (branchOpenIssues.length > 0) {
        // Count by urgency
        const critical = branchOpenIssues.filter(i => i.urgency === 'Critical').length;
        const high = branchOpenIssues.filter(i => i.urgency === 'High').length;
        const medium = branchOpenIssues.filter(i => i.urgency === 'Medium').length;
        const low = branchOpenIssues.filter(i => i.urgency === 'Low').length;

        stats.push({
          branch,
          total: branchOpenIssues.length,
          critical,
          high,
          medium,
          low,
        });
      }
    });

    // Sort by total (descending)
    return stats.sort((a, b) => b.total - a.total);
  }

  /**
   * Get statistics for a specific BRANCH (CORRECTED)
   * @param {string} branch - Branch name (JHQ/TRK/GS/IPIL)
   * @returns {object} - Branch statistics
   */
  getBranchStats(branch) {
    const today = this.getTodayDateString();
    const allBranchIssues = issueManager.getAllIssues({});
    const branchIssues = allBranchIssues.filter(i => i.branch === branch);
    
    // Today's issues
    const todayIssues = branchIssues.filter(issue => {
      const issueDate = issue.created_at.split(' ')[0];
      return issueDate === today;
    });

    // All time open issues
    const openIssues = branchIssues.filter(i => isOpenStatus(i.status));

    return {
      branch,
      today: {
        total: todayIssues.length,
        resolved: todayIssues.filter(i => isClosedStatus(i.status)).length,
        open: todayIssues.filter(i => isOpenStatus(i.status)).length,
      },
      allTime: {
        total: branchIssues.length,
        open: openIssues.length,
      },
    };
  }

  /**
   * Format today's statistics as a message
   * @returns {string} - Formatted message
   */
  formatTodayStatsMessage() {
    const overall = this.getTodayStats();
    const branchStats = this.getBranchStatsToday();  // CORRECTED: By branch
    const urgencyStats = this.getUrgencyStatsToday();

    let message = `📊 HELPDESK STATISTICS - Today (${this.getFormattedDate()})\n\n`;
    
    // Overall stats
    message += `📈 OVERALL:\n`;
    message += `├─ Total Issues: ${overall.total}\n`;
    message += `├─ Open: ${overall.open}\n`;
    message += `├─ Resolved: ${overall.resolved}\n`;
    message += `└─ Resolution Rate: ${overall.resolutionRate}%\n\n`;

    // By BRANCH (corrected)
    if (branchStats.length > 0) {
      message += `🏢 BY BRANCH:\n`;
      branchStats.forEach((branch, index) => {
        const prefix = index === branchStats.length - 1 ? '└─' : '├─';
        message += `${prefix} ${branch.branch}: ${branch.total} (${branch.open} open, ${branch.resolved} resolved)\n`;
      });
      message += `\n`;
    }

    // By urgency
    message += `⚠️ BY URGENCY:\n`;
    const urgencyOrder = ['Critical', 'High', 'Medium', 'Low'];
    urgencyOrder.forEach((level, index) => {
      const stats = urgencyStats[level];
      if (stats && stats.total > 0) {
        const prefix = index === urgencyOrder.length - 1 ? '└─' : '├─';
        message += `${prefix} ${level}: ${stats.total} (${stats.open} open)\n`;
      }
    });

    return message.trim();
  }

  /**
   * Format open issues message
   * @returns {string} - Formatted message
   */
  formatOpenIssuesMessage() {
    const openByBranch = this.getOpenIssuesByBranch();  // CORRECTED: By branch
    const totalOpen = openByBranch.reduce((sum, branch) => sum + branch.total, 0);

    let message = `📋 OPEN ISSUES - ${this.getFormattedDate()}\n\n`;
    message += `Total Open: ${totalOpen}\n\n`;

    if (openByBranch.length > 0) {
      message += `🏢 BY BRANCH:\n`;
      openByBranch.forEach((branch, index) => {
        const prefix = index === openByBranch.length - 1 ? '└─' : '├─';
        message += `${prefix} ${branch.branch}: ${branch.total}\n`;
        
        // Show urgency breakdown
        const urgencyParts = [];
        if (branch.critical > 0) urgencyParts.push(`🔴 ${branch.critical} Critical`);
        if (branch.high > 0) urgencyParts.push(`🟠 ${branch.high} High`);
        if (branch.medium > 0) urgencyParts.push(`🟡 ${branch.medium} Medium`);
        if (branch.low > 0) urgencyParts.push(`🟢 ${branch.low} Low`);
        
        if (urgencyParts.length > 0) {
          const spacing = index === openByBranch.length - 1 ? '  ' : '│ ';
          message += `${spacing}  ${urgencyParts.join(', ')}\n`;
        }
      });
    } else {
      message += `✅ No open issues!`;
    }

    return message.trim();
  }

  /**
   * Format branch-specific statistics (CORRECTED)
   * @param {string} branch - Branch name (JHQ/TRK/GS/IPIL)
   * @returns {string} - Formatted message
   */
  formatBranchStatsMessage(branch) {
    const stats = this.getBranchStats(branch);
    
    let message = `📊 ${branch} BRANCH STATISTICS\n\n`;
    
    message += `📅 TODAY (${this.getFormattedDate()}):\n`;
    message += `├─ Total Issues: ${stats.today.total}\n`;
    message += `├─ Open: ${stats.today.open}\n`;
    message += `└─ Resolved: ${stats.today.resolved}\n\n`;
    
    message += `📈 ALL TIME:\n`;
    message += `├─ Total Issues: ${stats.allTime.total}\n`;
    message += `└─ Currently Open: ${stats.allTime.open}`;

    return message.trim();
  }

  /**
   * Generate daily summary report
   * Sent automatically at end of day
   * @returns {string} - Daily summary message
   */
  generateDailySummary() {
    const overall = this.getTodayStats();
    const branchStats = this.getBranchStatsToday();  // CORRECTED: By branch
    const urgencyStats = this.getUrgencyStatsToday();
    const openByBranch = this.getOpenIssuesByBranch();  // CORRECTED: By branch

    let message = `📊 DAILY HELPDESK REPORT - ${this.getFormattedDate()}\n\n`;
    message += `═══════════════════════════════════════\n`;
    message += `OVERALL PERFORMANCE\n`;
    message += `═══════════════════════════════════════\n`;
    message += `Total Issues: ${overall.total}\n`;
    message += `├─ Resolved/Confirmed: ${overall.resolved} (${overall.resolutionRate}% resolution rate)\n`;
    message += `├─ In Progress: ${overall.inProgress}\n`;
    message += `└─ Pending: ${overall.pending}\n\n`;

    if (branchStats.length > 0) {
      message += `═══════════════════════════════════════\n`;
      message += `BRANCH BREAKDOWN\n`;
      message += `═══════════════════════════════════════\n`;
      
      branchStats.forEach(branch => {
        message += `🏢 ${branch.branch}: ${branch.total} issues\n`;
        message += `   ├─ Resolution Rate: ${branch.resolutionRate}%\n`;
        message += `   └─ Currently Open: ${branch.open}\n\n`;
      });
    }

    // Critical alerts
    const criticalOpen = urgencyStats.Critical?.open || 0;
    if (criticalOpen > 0) {
      message += `═══════════════════════════════════════\n`;
      message += `⚠️ ALERTS\n`;
      message += `═══════════════════════════════════════\n`;
      message += `🔴 ${criticalOpen} CRITICAL issue${criticalOpen > 1 ? 's' : ''} still open\n\n`;
    }

    // Open issues summary
    const totalOpen = openByBranch.reduce((sum, branch) => sum + branch.total, 0);
    if (totalOpen > 0) {
      message += `═══════════════════════════════════════\n`;
      message += `OPEN ISSUES (Carried Over)\n`;
      message += `═══════════════════════════════════════\n`;
      openByBranch.forEach(branch => {
        message += `${branch.branch}: ${branch.total} open\n`;
      });
    }

    return message.trim();
  }

  /**
   * Get today's date as YYYY-MM-DD
   * @returns {string} - Date string
   */
  getTodayDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Get formatted date for display
   * @returns {string} - Formatted date
   */
  getFormattedDate() {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
  }
}

// Export singleton instance
module.exports = new StatsService();
