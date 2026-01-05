/**
 * Viber Helpdesk Bot - Main Server
 * 
 * This is the entry point for the Viber Helpdesk Bot.
 * It sets up the Express webhook server and handles incoming Viber events.
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
const BotEvents = require('viber-bot').Events;

// Import modules
const config = require('./config');
const viberService = require('./viberService');
const messageHandler = require('./messageHandler');
const conversationManager = require('./conversationManager');
const issueManager = require('./issueManager');

// Validate configuration
if (!config.viber.authToken) {
  console.error('❌ VIBER_AUTH_TOKEN is not set in .env file');
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
const bot = viberService.getBot();

// Health check endpoint
app.get('/', (req, res) => {
  res.send({
    status: 'OK',
    bot: config.viber.botName,
    timestamp: new Date().toISOString(),
  });
});

// Viber webhook endpoint
app.use('/viber/webhook', bot.middleware());

// Set webhook
bot.setWebhook(config.server.webhookUrl + '/viber/webhook')
  .then(() => {
    console.log('✅ Webhook set successfully');
    console.log(`📍 Webhook URL: ${config.server.webhookUrl}/viber/webhook`);
  })
  .catch(error => {
    console.error('❌ Error setting webhook:', error);
  });

// Event: Bot subscribed (user started conversation)
bot.on(BotEvents.SUBSCRIBED, async (response) => {
  const userId = response.userProfile.id;
  const userName = response.userProfile.name;
  
  console.log(`[Bot] User subscribed: ${userName} (${userId})`);
  
  await viberService.sendMessage(
    userId,
    `👋 Hello ${userName}!\n\nWelcome to the ${config.viber.botName}.\n\nI'm here to help you submit and track helpdesk issues.\n\nSend any message to create a new issue.`
  );
});

// Event: User unsubscribed
bot.on(BotEvents.UNSUBSCRIBED, (userId) => {
  console.log(`[Bot] User unsubscribed: ${userId}`);
  
  // Clean up any active conversation
  conversationManager.endConversation(userId);
});

// Event: Message received
bot.on(BotEvents.MESSAGE_RECEIVED, async (message, response) => {
  const userProfile = response.userProfile;
  
  // Only handle text messages
  if (message.text) {
    try {
      await messageHandler.handleMessage(message, userProfile);
    } catch (error) {
      console.error('[Bot] Error handling message:', error);
      await viberService.sendMessage(
        userProfile.id,
        '❌ An error occurred while processing your message. Please try again.'
      );
    }
  } else {
    // Handle non-text messages (images, stickers, etc.)
    await viberService.sendMessage(
      userProfile.id,
      'ℹ️ Please send text messages only. Images and other media are not supported at this time.'
    );
  }
});

// Event: Conversation started (rare, mainly for bot info)
bot.on(BotEvents.CONVERSATION_STARTED, async (response, isSubscribed) => {
  console.log(`[Bot] Conversation started with: ${response.userProfile.id}`);
});

// Event: Error
bot.on(BotEvents.ERROR, (error) => {
  console.error('[Bot] Viber bot error:', error);
});

// Cleanup routine - remove expired conversations every 5 minutes
setInterval(() => {
  conversationManager.cleanupExpiredConversations();
}, 5 * 60 * 1000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down gracefully...');
  
  // Close database connection
  issueManager.close();
  
  console.log('[Server] Cleanup completed. Goodbye!');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Server] Received SIGTERM, shutting down...');
  issueManager.close();
  process.exit(0);
});

// Start server
app.listen(port, () => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🤖 Viber Helpdesk Bot Server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Server running on port ${port}`);
  console.log(`📍 Webhook: ${config.server.webhookUrl}/viber/webhook`);
  console.log(`🤖 Bot Name: ${config.viber.botName}`);
  console.log(`💾 Database: ${config.database.path}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('ℹ️  Waiting for messages...\n');
});

// Export for testing
module.exports = app;
