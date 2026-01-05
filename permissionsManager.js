/**
 * Permissions Manager
 * Handles user authorization and role management
 * Determines if users can create issues or update statuses
 */

const config = require('./config');

class PermissionsManager {
  constructor() {
    this.supportStaffIds = new Set(config.auth.supportStaffIds);
    this.employeeIds = new Set(config.auth.employeeIds);
    this.allowAllEmployees = this.employeeIds.size === 0;
  }

  /**
   * Check if user is support staff
   * @param {string} userId - Viber user ID
   * @returns {boolean}
   */
  isSupportStaff(userId) {
    return this.supportStaffIds.has(userId);
  }

  /**
   * Check if user is authorized employee (can create issues)
   * @param {string} userId - Viber user ID
   * @returns {boolean}
   */
  isAuthorizedEmployee(userId) {
    // If allowAllEmployees is true, everyone is authorized
    if (this.allowAllEmployees) {
      return true;
    }

    // Otherwise, check if user is in the employee whitelist
    return this.employeeIds.has(userId);
  }

  /**
   * Check if user can create issues
   * Support staff can also create issues
   * @param {string} userId - Viber user ID
   * @returns {boolean}
   */
  canCreateIssue(userId) {
    return this.isAuthorizedEmployee(userId) || this.isSupportStaff(userId);
  }

  /**
   * Check if user can update issue status
   * Only support staff can update status
   * @param {string} userId - Viber user ID
   * @returns {boolean}
   */
  canUpdateStatus(userId) {
    return this.isSupportStaff(userId);
  }

  /**
   * Get user role description
   * @param {string} userId - Viber user ID
   * @returns {string}
   */
  getUserRole(userId) {
    if (this.isSupportStaff(userId)) {
      return 'Support Staff';
    } else if (this.isAuthorizedEmployee(userId)) {
      return 'Employee';
    } else {
      return 'Unauthorized';
    }
  }

  /**
   * Add support staff member
   * @param {string} userId - Viber user ID
   */
  addSupportStaff(userId) {
    this.supportStaffIds.add(userId);
    console.log(`[PermissionsManager] Added support staff: ${userId}`);
  }

  /**
   * Remove support staff member
   * @param {string} userId - Viber user ID
   */
  removeSupportStaff(userId) {
    this.supportStaffIds.delete(userId);
    console.log(`[PermissionsManager] Removed support staff: ${userId}`);
  }

  /**
   * Add authorized employee
   * @param {string} userId - Viber user ID
   */
  addEmployee(userId) {
    this.employeeIds.add(userId);
    this.allowAllEmployees = false; // Disable allow-all when specific employees are added
    console.log(`[PermissionsManager] Added employee: ${userId}`);
  }

  /**
   * Remove authorized employee
   * @param {string} userId - Viber user ID
   */
  removeEmployee(userId) {
    this.employeeIds.delete(userId);
    console.log(`[PermissionsManager] Removed employee: ${userId}`);
  }

  /**
   * Get list of all support staff IDs
   * @returns {array}
   */
  getSupportStaffList() {
    return Array.from(this.supportStaffIds);
  }

  /**
   * Get list of all authorized employee IDs
   * @returns {array}
   */
  getEmployeeList() {
    return Array.from(this.employeeIds);
  }

  /**
   * Check authorization and return message if unauthorized
   * @param {string} userId - Viber user ID
   * @param {string} action - Action being attempted ('create' or 'update')
   * @returns {object} - { authorized: boolean, message: string }
   */
  checkAuthorization(userId, action) {
    if (action === 'create') {
      if (this.canCreateIssue(userId)) {
        return { authorized: true, message: null };
      } else {
        return {
          authorized: false,
          message: '⛔ You are not authorized to create issues. Please contact your administrator.',
        };
      }
    } else if (action === 'update') {
      if (this.canUpdateStatus(userId)) {
        return { authorized: true, message: null };
      } else {
        return {
          authorized: false,
          message: '⛔ Only support staff can update issue status.',
        };
      }
    }

    return {
      authorized: false,
      message: '⛔ Invalid action.',
    };
  }
}

// Export singleton instance
module.exports = new PermissionsManager();
