/**
 * Scheduler Service
 * 
 * AUTOMATED DAILY REPORTS
 * 
 * Purpose:
 * Handles scheduled tasks such as daily summary reports.
 * Runs in the background without user intervention.
 * 
 * Why This Exists:
 * - Management needs end-of-day summaries without manual requests
 * - Provides consistent daily operational visibility
 * - Lightweight scheduling (no external dependencies like cron)
 * 
 * Design:
 * - Uses setInterval for daily checks
 * - Configurable report time (default: 6:00 PM)
 * - Sends to central monitoring group only
 * - Fails gracefully if monitoring not configured
 * 
 * Author: Tech Solutions Inc.
 * Date: January 2026
 */

const config = require('./config');
const statsService = require('./statsService');
const messagingAdapter = require('./messagingAdapter');

class SchedulerService {
  constructor() {
    this.reportSent = false;
    this.checkInterval = null;
    
    // Default report time: 18:00 (6:00 PM)
    this.reportHour = parseInt(process.env.DAILY_REPORT_HOUR || '18', 10);
    this.reportMinute = parseInt(process.env.DAILY_REPORT_MINUTE || '0', 10);
    
    console.log(`[SchedulerService] Daily report scheduled for ${this.reportHour}:${String(this.reportMinute).padStart(2, '0')}`);
  }

  /**
   * Start the scheduler
   * Checks every minute if it's time to send the daily report
   */
  start() {
    // Check every minute
    this.checkInterval = setInterval(() => {
      this.checkDailyReport();
    }, 60 * 1000); // 60 seconds

    console.log('[SchedulerService] Started');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      console.log('[SchedulerService] Stopped');
    }
  }

  /**
   * Check if it's time to send the daily report
   */
  async checkDailyReport() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Check if it's the scheduled time
    if (currentHour === this.reportHour && currentMinute === this.reportMinute) {
      // Only send once per day
      if (!this.reportSent) {
        await this.sendDailyReport();
        this.reportSent = true;
      }
    } else {
      // Reset flag at midnight
      if (currentHour === 0 && currentMinute === 0) {
        this.reportSent = false;
      }
    }
  }

  /**
   * Send the daily report to central monitoring
   */
  async sendDailyReport() {
    // Check if central monitoring is enabled
    if (!config.support.enableCentralMonitoring || !config.support.centralMonitoringGroup) {
      console.log('[SchedulerService] Daily report not sent - central monitoring not configured');
      return;
    }

    try {
      console.log('[SchedulerService] Generating daily report...');
      
      const report = statsService.generateDailySummary();
      
      await messagingAdapter.sendGroupMessage(
        config.support.centralMonitoringGroup,
        report
      );

      console.log('[SchedulerService] Daily report sent successfully');
    } catch (error) {
      console.error('[SchedulerService] Error sending daily report:', error);
    }
  }

  /**
   * Send report immediately (for testing)
   */
  async sendReportNow() {
    console.log('[SchedulerService] Sending report immediately (manual trigger)');
    await this.sendDailyReport();
  }
}

// Export singleton instance
module.exports = new SchedulerService();
