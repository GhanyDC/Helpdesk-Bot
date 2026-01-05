/**
 * Database Query Utility
 * 
 * Helpful queries for managing and viewing your helpdesk data
 * Copy these queries and run them using sqlite3 CLI or DB Browser for SQLite
 * 
 * This file is for reference only and exports an empty object.
 */

/*
═══════════════════════════════════════════════════════════════
VIEWING ISSUES
═══════════════════════════════════════════════════════════════

-- View all issues (latest first)
SELECT * FROM issues ORDER BY created_at DESC;

-- View only NEW issues
SELECT * FROM issues WHERE status = 'NEW' ORDER BY created_at DESC;

-- View HIGH priority issues
SELECT * FROM issues WHERE urgency = 'High' OR urgency = 'Critical' ORDER BY created_at DESC;

-- View issues by department
SELECT * FROM issues WHERE department = 'Sales' ORDER BY created_at DESC;

-- Count issues by status
SELECT status, COUNT(*) as count FROM issues GROUP BY status;

-- Count issues by department
SELECT department, COUNT(*) as count FROM issues GROUP BY department;


═══════════════════════════════════════════════════════════════
ISSUE DETAILS
═══════════════════════════════════════════════════════════════

-- View specific issue with full details
SELECT * FROM issues WHERE issue_id = 'ISSUE-20260105-0001';

-- View issue with status history
SELECT 
  i.*,
  GROUP_CONCAT(
    sh.new_status || ' by ' || sh.updated_by_name || ' at ' || sh.updated_at, 
    CHAR(10)
  ) as history
FROM issues i
LEFT JOIN status_history sh ON i.issue_id = sh.issue_id
WHERE i.issue_id = 'ISSUE-20260105-0001'
GROUP BY i.issue_id;


═══════════════════════════════════════════════════════════════
STATUS HISTORY
═══════════════════════════════════════════════════════════════

-- View all status changes
SELECT * FROM status_history ORDER BY updated_at DESC;

-- View status changes for specific issue
SELECT * FROM status_history 
WHERE issue_id = 'ISSUE-20260105-0001' 
ORDER BY updated_at ASC;

-- See who resolved the most issues
SELECT 
  updated_by_name,
  COUNT(*) as resolved_count
FROM status_history
WHERE new_status = 'RESOLVED'
GROUP BY updated_by_name
ORDER BY resolved_count DESC;


═══════════════════════════════════════════════════════════════
ANALYTICS
═══════════════════════════════════════════════════════════════

-- Average time to resolution (in hours)
SELECT 
  AVG(
    (julianday(resolved_at) - julianday(created_at)) * 24
  ) as avg_hours_to_resolve
FROM issues
WHERE status = 'RESOLVED';

-- Issues created today
SELECT * FROM issues 
WHERE DATE(created_at) = DATE('now')
ORDER BY created_at DESC;

-- Issues created this week
SELECT * FROM issues 
WHERE created_at >= datetime('now', '-7 days')
ORDER BY created_at DESC;

-- Most common issue categories
SELECT 
  category,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM issues), 2) as percentage
FROM issues
GROUP BY category
ORDER BY count DESC;


═══════════════════════════════════════════════════════════════
MAINTENANCE
═══════════════════════════════════════════════════════════════

-- Delete all issues (CAREFUL! This is permanent)
DELETE FROM issues;
DELETE FROM status_history;

-- Delete issues older than 90 days
DELETE FROM issues 
WHERE created_at < datetime('now', '-90 days');

-- Backup database (run in terminal, not SQL)
sqlite3 data/helpdesk.db ".backup data/helpdesk_backup.db"


═══════════════════════════════════════════════════════════════
EXPORT TO CSV
═══════════════════════════════════════════════════════════════

-- Export all issues to CSV (run in terminal)
sqlite3 -header -csv data/helpdesk.db "SELECT * FROM issues;" > issues.csv

-- Export with status history (run in terminal)
sqlite3 -header -csv data/helpdesk.db "SELECT * FROM status_history;" > history.csv

*/

module.exports = {};
