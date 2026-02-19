/**
 * Database Abstraction Layer
 *
 * PostgreSQL connection pool using node-postgres (pg).
 * - Connection pooling (shared globally)
 * - Readiness retry with exponential backoff (max 10 attempts)
 * - Schema initialization (issues, status_history, users, sessions)
 * - Graceful shutdown
 */

const { Pool } = require('pg');
const logger = require('./logger');

let pool = null;

function buildPoolConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'helpdesk',
    user: process.env.DB_USER || 'helpdesk',
    password: process.env.DB_PASSWORD || 'helpdesk',
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
}

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS issues (
    issue_id        TEXT PRIMARY KEY,
    employee_id     TEXT NOT NULL,
    employee_name   TEXT NOT NULL,
    branch          TEXT,
    department      TEXT NOT NULL,
    category        TEXT NOT NULL,
    urgency         TEXT NOT NULL,
    description     TEXT NOT NULL,
    contact_person  TEXT,
    remarks         TEXT,
    assigned_to     TEXT,
    assigned_to_name TEXT,
    status          TEXT NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at     TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS status_history (
    id              SERIAL PRIMARY KEY,
    issue_id        TEXT REFERENCES issues(issue_id) ON DELETE CASCADE,
    old_status      TEXT,
    new_status      TEXT NOT NULL,
    updated_by      TEXT NOT NULL,
    updated_by_name TEXT,
    remarks         TEXT,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    telegram_id  TEXT PRIMARY KEY,
    username     TEXT,
    first_name   TEXT,
    last_name    TEXT,
    full_name    TEXT,
    chat_id      TEXT,
    role         TEXT CHECK (role IN ('employee', 'support', 'admin')) DEFAULT 'employee',
    first_seen   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    message_count INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS sessions (
    telegram_id TEXT PRIMARY KEY,
    state       TEXT,
    data        JSONB,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

async function waitForDatabase(maxRetries = 10, baseDelay = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = await pool.connect();
      client.release();
      logger.info('Database connection established');
      return;
    } catch (err) {
      const delay = baseDelay * Math.pow(2, Math.min(attempt - 1, 4));
      logger.warn(`DB attempt ${attempt}/${maxRetries} failed: ${err.message}. Retry in ${delay}ms`);
      if (attempt === maxRetries) {
        throw new Error(`Could not connect after ${maxRetries} attempts`);
      }
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

async function initialize() {
  const cfg = buildPoolConfig();
  pool = new Pool(cfg);
  pool.on('error', (err) => {
    logger.error('Unexpected pool error', { error: err.message });
  });
  logger.info(`Connecting to PostgreSQL at ${cfg.host || 'DATABASE_URL'}:${cfg.port || ''}`);
  await waitForDatabase();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(SCHEMA_SQL);
    await client.query('COMMIT');
    logger.info('Schema initialized');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Schema init failed', { error: err.message });
    throw err;
  } finally {
    client.release();
  }
}

async function query(text, params = []) {
  return pool.query(text, params);
}

async function getClient() {
  return pool.connect();
}

async function close() {
  if (pool) {
    await pool.end();
    logger.info('Database pool closed');
  }
}

module.exports = { initialize, query, getClient, close };
