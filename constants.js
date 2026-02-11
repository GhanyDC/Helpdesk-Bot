/**
 * Constants Module
 * Defines all conversation steps, issue categories, and status values
 * 
 * IMPORTANT ORGANIZATIONAL STRUCTURE:
 * - BRANCHES = Physical locations / companies (JHQ, TRK, GS, IPIL)
 *   → Used for ROUTING tickets to support groups
 *   → Each branch has ONE support group
 * 
 * - DEPARTMENTS = Functional divisions (Accounting, Sales, HR, etc.)
 *   → Used for CONTEXT ONLY (stored as metadata)
 *   → NOT used for routing decisions
 */

// Conversation Steps - tracks where user is in the flow
const CONVERSATION_STEPS = {
  START: 'START',
  BRANCH: 'BRANCH',           // Ask for branch FIRST (routing key)
  DEPARTMENT: 'DEPARTMENT',   // Ask for department SECOND (context only)
  CATEGORY: 'CATEGORY',
  URGENCY: 'URGENCY',
  DESCRIPTION: 'DESCRIPTION',
  CONTACT: 'CONTACT',
  CONFIRMATION: 'CONFIRMATION',
  COMPLETED: 'COMPLETED',
  AWAITING_REMARKS: 'AWAITING_REMARKS', // Support staff must provide remarks on resolve
};

// Branch/Company Options (ROUTING KEY)
// Each branch has its own support group
const BRANCHES = {
  JHQ: 'JHQ',   // Main Head Office
  TRK: 'TRK',   // Regional Office
  GS: 'GS',     // Service Center
  IPIL: 'IPIL', // IPIL Office
};

// Department Options (CONTEXT ONLY - NOT FOR ROUTING)
// Stored in ticket for informational purposes
const DEPARTMENTS = {
  ACCOUNTING: 'Accounting',
  SALES: 'Sales',
  HR: 'HR',
  OPERATIONS: 'Operations',
  IT: 'IT',
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
  PENDING: 'pending',
  IN_PROCESS: 'in-process',
  RESOLVED: 'resolved',
  RESOLVED_WITH_ISSUES: 'resolved-with-issues',
  CONFIRMED: 'confirmed',
  CANCELLED_STAFF: 'cancelled-staff',
  CANCELLED_USER: 'cancelled-user',
};

// Display labels for each status (with emoji)
const STATUS_LABELS = {
  'pending': '⏳ Pending',
  'in-process': '🔧 In Process',
  'resolved': '✅ Resolved',
  'resolved-with-issues': '⚠️ Resolved with Issues',
  'confirmed': '✅ Confirmed',
  'closed': '✅ Closed',           // Legacy compatibility
  'cancelled-staff': '❌ Cancelled (Staff)',
  'cancelled-user': '❌ Cancelled (User)',
};

// Terminal statuses — no further updates allowed
const TERMINAL_STATUSES = ['confirmed', 'closed', 'cancelled-staff', 'cancelled-user'];

// Short codes for callback data (inline button callback_data has 64-byte limit)
const STATUS_CODES = {
  'ip': 'in-process',
  'rv': 'resolved',
  'rwi': 'resolved-with-issues',
  'cs': 'cancelled-staff',
  'cu': 'cancelled-user',
};

// Support Staff Keywords (legacy compatibility)
const SUPPORT_KEYWORDS = {
  PENDING: 'pending',
  IN_PROCESS: 'in-process',
  RESOLVED: 'resolved',
  RESOLVED_WITH_ISSUES: 'resolved-with-issues',
  CONFIRMED: 'confirmed',
  CANCELLED_STAFF: 'cancelled-staff',
  CANCELLED_USER: 'cancelled-user',
};

module.exports = {
  CONVERSATION_STEPS,
  BRANCHES,
  DEPARTMENTS,
  CATEGORIES,
  URGENCY_LEVELS,
  ISSUE_STATUS,
  STATUS_LABELS,
  TERMINAL_STATUSES,
  STATUS_CODES,
  SUPPORT_KEYWORDS,
};
