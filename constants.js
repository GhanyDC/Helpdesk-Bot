/**
 * Constants Module
 * Defines all conversation steps, issue categories, and status values
 */

// Conversation Steps - tracks where user is in the flow
const CONVERSATION_STEPS = {
  START: 'START',
  DEPARTMENT: 'DEPARTMENT',
  CATEGORY: 'CATEGORY',
  URGENCY: 'URGENCY',
  DESCRIPTION: 'DESCRIPTION',
  CONTACT: 'CONTACT',
  CONFIRMATION: 'CONFIRMATION',
  COMPLETED: 'COMPLETED',
};

// Department Options
const DEPARTMENTS = {
  SALES: 'Sales',
  ACCOUNTING: 'Accounting',
  BRANCH: 'Branch',
  HR: 'HR',
  OPERATIONS: 'Operations',
  OTHER: 'Other',
};

// Issue Categories
const CATEGORIES = {
  SYSTEM: 'System Issue',
  NETWORK: 'Network Problem',
  HARDWARE: 'Hardware Issue',
  SOFTWARE: 'Software Issue',
  ACCESS: 'Access/Permission',
  OTHER: 'Other',
};

// Urgency Levels
const URGENCY_LEVELS = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

// Issue Status Values
const ISSUE_STATUS = {
  NEW: 'NEW',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  ONGOING: 'ONGOING',
  RESOLVED: 'RESOLVED',
};

// Support Staff Keywords
const SUPPORT_KEYWORDS = {
  ACK: 'ACK',
  ONGOING: 'ONGOING',
  RESOLVED: 'RESOLVED',
};

module.exports = {
  CONVERSATION_STEPS,
  DEPARTMENTS,
  CATEGORIES,
  URGENCY_LEVELS,
  ISSUE_STATUS,
  SUPPORT_KEYWORDS,
};
