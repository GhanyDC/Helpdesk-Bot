/**
 * Telegram Helpdesk Bot - Main Server
 * 
 * This is the entry point for the Telegram Helpdesk Bot.
 * It sets up the Express webhook server and handles incoming Telegram updates.
 * 
 * Features:
 * - Receives messages from employees
 * - Manages step-by-step issue creation flow
 * - Handles support staff status update commands
 * - Logs all issues to SQLite database
 * - Sends notifications to central support group
 * - Auto-generates unique Issue IDs
 * 
 * Author: Your Company
 * Date: January 2026
 */

const express = require('express');
const bodyParser = require('body-parser');

// Import modules
const config = require('./config');
const telegramService = require('./telegramService');
const messageHandler = require('./messageHandler');
const conversationManager = require('./conversationManager');
const issueManager = require('./issueManager');
const schedulerService = require('./schedulerService');

// Validate configuration
if (!config.telegram.authToken) {
  console.error('❌ TELEGRAM_BOT_TOKEN is not set in .env file');
  process.exit(1);
}

if (!config.server.webhookUrl) {
  console.error('❌ WEBHOOK_URL is not set in .env file');
  console.error('ℹ️  You need to set up ngrok and configure the webhook URL');
  process.exit(1);
}

// Initialize Express app
const app = express();
const port = config.server.port;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Get bot instance
const bot = telegramService.getBot();

// Health check endpoint
app.get('/', (req, res) => {
  res.send({
    status: 'OK',
    bot: config.telegram.botName,
    timestamp: new Date().toISOString(),
  });
});

// Telegram webhook endpoint
app.post('/telegram/webhook', async (req, res) => {
  try {
    const update = req.body;
    
    // Handle different types of updates
    if (update.message) {
      await handleMessage(update.message);
    } else if (update.callback_query) {
      // Handle callback queries if needed in the future
      console.log('[Bot] Callback query received');
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error('[Bot] Error processing update:', error);
    res.sendStatus(500);
  }
});

// Handle incoming messages
async function handleMessage(message) {
  const chatId = message.chat.id;
  const userId = message.from.id.toString();
  const userName = message.from.first_name || 'User';
  
  // Handle different message types
  if (message.text) {
    // Check for /start command
    if (message.text === '/start') {
      await telegramService.sendMessage(
        chatId,
        `👋 Hello ${userName}!\n\nWelcome to the ${config.telegram.botName}.\n\nI'm here to help you submit and track helpdesk issues.\n\n📋 To create an issue: Send any message\n📊 For statistics: Send /stats\n❓ For help: Send /help`
      );
      return;
    }
    
    // Create user profile object similar to Viber format
    const userProfile = {
      id: userId,
      name: userName,
      chatId: chatId,
    };
    
    try {
      await messageHandler.handleMessage(message, userProfile);
    } catch (error) {
      console.error('[Bot] Error handling message:', error);
      await telegramService.sendMessage(
        chatId,
        '❌ An error occurred while processing your message. Please try again.'
      );
    }
  } else {
    // Handle non-text messages (images, stickers, etc.)
    await telegramService.sendMessage(
      chatId,
      'ℹ️ Please send text messages only. Images and other media are not supported at this time.'
    );
  }
}

// Set webhook
const webhookUrl = `${config.server.webhookUrl}/telegram/webhook`;
bot.setWebHook(webhookUrl)
  .then(() => {
    console.log('✅ Webhook set successfully');
    console.log(`📍 Webhook URL: ${webhookUrl}`);
  })
  .catch(error => {
    console.error('❌ Error setting webhook:', error);
  });

// Cleanup routine - remove expired conversations every 5 minutes
setInterval(() => {
  conversationManager.cleanupExpiredConversations();
}, 5 * 60 * 1000);

// Start scheduler for daily reports
schedulerService.start();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down gracefully...');
  
  // Stop scheduler
  schedulerService.stop();
  
  // Close database connection
  issueManager.close();
  
  console.log('[Server] Cleanup completed. Goodbye!');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Server] Received SIGTERM, shutting down...');
  schedulerService.stop();
  issueManager.close();
  process.exit(0);
});

// Start server
app.listen(port, () => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🤖 Telegram Helpdesk Bot Server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Server running on port ${port}`);
  console.log(`📍 Webhook: ${config.server.webhookUrl}/telegram/webhook`);
  console.log(`🤖 Bot Name: ${config.telegram.botName}`);
  console.log(`💾 Database: ${config.database.path}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('ℹ️  Waiting for messages...\n');
});

// Export for testing
module.exports = app;
