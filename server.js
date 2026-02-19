/**
 * Telegram Helpdesk Bot — Main Server
 *
 * Hardened for on-prem production:
 *  - /health endpoint
 *  - Secret webhook path
 *  - Graceful shutdown (SIGTERM, SIGINT)
 *  - Structured logging (winston)
 *  - Env validation at startup (handled by config.js)
 *  - Unhandled rejection / uncaught exception guards
 */

const express = require('express');
const bodyParser = require('body-parser');

const logger = require('./logger');
const db = require('./db');
const config = require('./config');
const telegramService = require('./telegramService');
const messageHandler = require('./messageHandler');
const conversationManager = require('./conversationManager');
const schedulerService = require('./schedulerService');
const userIdLogger = require('./userIdLogger');

const app = express();
const port = config.server.port;

// ── Middleware ──────────────────────────────────────────────────────
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ── Health endpoint ────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', error: err.message });
  }
});

// Legacy root health (Docker HEALTHCHECK)
app.get('/', (req, res) => {
  res.json({ status: 'ok', bot: config.telegram.botName, timestamp: new Date().toISOString() });
});

// ── Secret webhook endpoint ────────────────────────────────────────
const webhookPath = `/telegram/webhook/${config.server.webhookSecret}`;

app.post(webhookPath, async (req, res) => {
  try {
    const update = req.body;
    logger.debug('Webhook update received', { updateId: update.update_id });

    if (update.message) {
      await handleMessage(update.message);
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    }
    res.sendStatus(200);
  } catch (error) {
    logger.error('Error processing webhook update', { error: error.message, stack: error.stack });
    res.sendStatus(200); // always 200 so Telegram doesn't retry
  }
});

// ── Callback query handler ─────────────────────────────────────────
async function handleCallbackQuery(callbackQuery) {
  const userId = callbackQuery.from.id.toString();
  const userName = callbackQuery.from.first_name || 'User';
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;

  logger.info('Callback query', { userId, userName, data });

  await userIdLogger.logUser({
    id: callbackQuery.from.id,
    username: callbackQuery.from.username,
    first_name: callbackQuery.from.first_name,
    last_name: callbackQuery.from.last_name,
    chat_id: chatId,
  });

  try {
    await messageHandler.handleCallbackQuery({
      callbackQueryId: callbackQuery.id,
      userId, userName, chatId, messageId, data,
      message: callbackQuery.message,
    });
  } catch (error) {
    logger.error('Callback query error', { userId, error: error.message, stack: error.stack });
    await telegramService.answerCallbackQuery(callbackQuery.id, '❌ An error occurred');
  }
}

// ── Message handler ────────────────────────────────────────────────
async function handleMessage(message) {
  const chatId = message.chat.id;
  const userId = message.from.id.toString();
  const userName = message.from.first_name || 'User';
  const chatType = message.chat.type;
  const isGroupChat = chatType === 'group' || chatType === 'supergroup';

  await userIdLogger.logUser({
    id: message.from.id,
    username: message.from.username,
    first_name: message.from.first_name,
    last_name: message.from.last_name,
    chat_id: chatId,
  });

  if (message.text) {
    if (message.text === '/start') {
      if (!isGroupChat) {
        await telegramService.sendMessage(
          chatId,
          `👋 Hello ${userName}!\n\nWelcome to the ${config.telegram.botName}.\n\nI'm here to help you submit and track helpdesk issues.\n\n📝 To create an issue: Send any message\n📊 For statistics: Send /stats\n❓ For help: Send /help`
        );
      }
      return;
    }

    const userProfile = { id: userId, name: userName, chatId, isGroup: isGroupChat };

    try {
      await messageHandler.handleMessage(message, userProfile);
    } catch (error) {
      logger.error('Message handler error', { userId, error: error.message, stack: error.stack });
      await telegramService.sendMessage(chatId, '❌ An error occurred while processing your message. Please try again.');
    }
  } else {
    if (!isGroupChat) {
      await telegramService.sendMessage(chatId, 'ℹ️ Please send text messages only.\nImages and other media are not supported.');
    }
  }
}

// ── Boot sequence ──────────────────────────────────────────────────
let server;

async function boot() {
  // 1. Database
  await db.initialize();
  logger.info('Database ready (PostgreSQL pool)');

  // 2. Seed admin/support roles from env into users table
  await userIdLogger.seedRolesFromEnv();

  // 3. Telegram webhook (secret path)
  const bot = telegramService.getBot();
  const fullWebhookUrl = `${config.server.webhookUrl}${webhookPath}`;
  try {
    await bot.setWebHook(fullWebhookUrl);
    logger.info('Webhook set', { url: fullWebhookUrl });
  } catch (error) {
    logger.error('Webhook setup error', { error: error.message });
  }

  // 4. Lock central monitoring group
  if (config.support.enableCentralMonitoring && config.support.centralMonitoringGroup) {
    try {
      await telegramService.setChatPermissions(config.support.centralMonitoringGroup, {
        can_send_messages: false, can_send_media_messages: false,
        can_send_polls: false, can_send_other_messages: false,
        can_add_web_page_previews: false, can_change_info: false,
        can_invite_users: false, can_pin_messages: false,
      });
      logger.info('Central monitoring group locked');
    } catch (err) {
      logger.warn('Could not lock monitoring group', { error: err.message });
    }
  }

  // 5. Session cleanup every 5 min
  setInterval(() => conversationManager.cleanupExpiredConversations(), 5 * 60 * 1000);

  // 6. Scheduler
  schedulerService.start();

  // 7. Start Express
  server = app.listen(port, () => {
    logger.info('Server started', { port, webhook: fullWebhookUrl, bot: config.telegram.botName });
  });
}

// ── Graceful shutdown ──────────────────────────────────────────────
async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down...`);
  schedulerService.stop();
  if (server) server.close();
  await db.close();
  logger.info('Shutdown complete');
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { error: String(reason) });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

boot().catch((err) => {
  logger.error('Fatal startup error', { error: err.message, stack: err.stack });
  process.exit(1);
});

module.exports = app;
