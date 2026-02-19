/**
 * Structured Logger (winston)
 *
 * Enterprise-grade JSON logging with console + file transports.
 * All modules import this instead of using console.log.
 *
 * Log rotation is handled externally (logrotate / Docker log driver).
 * Files written: logs/app.log, logs/error.log
 */

const { createLogger, format, transports } = require('winston');
const path = require('path');

const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, 'logs');

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: 'helpdesk-bot' },
  transports: [
    // Console: colourised for local dev, JSON in production
    new transports.Console({
      format:
        process.env.NODE_ENV === 'production'
          ? format.json()
          : format.combine(format.colorize(), format.simple()),
    }),
    // Combined log file
    new transports.File({
      filename: path.join(LOG_DIR, 'app.log'),
      maxsize: 5 * 1024 * 1024, // 5 MB
      maxFiles: 5,
      tailable: true,
    }),
    // Error-only file
    new transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
    }),
  ],
  // Prevent winston from crashing the process
  exitOnError: false,
});

module.exports = logger;
