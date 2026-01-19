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
  BRANCH: 'BRANCH',           // NEW: Ask for branch FIRST (routing key)
  DEPARTMENT: 'DEPARTMENT',   // Ask for department SECOND (context only)
  CATEGORY: 'CATEGORY',
  URGENCY: 'URGENCY',
  DESCRIPTION: 'DESCRIPTION',
  CONTACT: 'CONTACT',
  CONFIRMATION: 'CONFIRMATION',
  COMPLETED: 'COMPLETED',
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
  BRANCHES,        // NEW: Branch constants
  DEPARTMENTS,
  CATEGORIES,
  URGENCY_LEVELS,
  ISSUE_STATUS,
  SUPPORT_KEYWORDS,
};
