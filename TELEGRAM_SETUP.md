# Telegram Helpdesk Bot - Setup Guide

## Migration Summary

This project has been successfully migrated from Viber to Telegram! 🎉

## What Changed

### Files Modified:
1. **package.json** - Updated to use `node-telegram-bot-api` instead of `viber-bot`
2. **config.js** - Changed from Viber configuration to Telegram configuration
3. **server.js** - Completely rewritten to handle Telegram webhooks
4. **messageHandler.js** - Updated to work with Telegram message format
5. **telegramService.js** - NEW file replacing viberService.js

### Key Differences:
- Telegram uses chat IDs instead of user IDs for sending messages
- Webhook endpoint changed from `/viber/webhook` to `/telegram/webhook`
- Environment variable changed from `VIBER_AUTH_TOKEN` to `TELEGRAM_BOT_TOKEN`
- Users start interaction with `/start` command in Telegram

## Setup Steps

### 1. Create a Telegram Bot

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` command
3. Choose a name for your bot (e.g., "Company Helpdesk Bot")
4. Choose a username for your bot (must end in 'bot', e.g., "company_helpdesk_bot")
5. BotFather will give you a **Bot Token** - save this!

### 2. Update Environment Variables

Update your `.env` file with the following changes:

```env
# Replace VIBER_AUTH_TOKEN with:
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# Keep the same:
BOT_NAME=Helpdesk Bot
PORT=3000
WEBHOOK_URL=https://your-ngrok-url.ngrok.io
SUPPORT_GROUP_ID=your_telegram_group_chat_id
DB_PATH=./data/helpdesk.db
SUPPORT_STAFF_IDS=123456789,987654321
EMPLOYEE_IDS=
```

### 3. Get Your Telegram Group Chat ID

To send issue notifications to a Telegram group:

1. Create a Telegram group
2. Add your bot to the group
3. Send a message in the group
4. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
5. Look for `"chat":{"id":-1001234567890` - the negative number is your group ID
6. Update `SUPPORT_GROUP_ID` in your `.env` file

### 4. Get User/Staff IDs

For `SUPPORT_STAFF_IDS` and `EMPLOYEE_IDS`:

1. Users should send `/start` to your bot
2. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Look for `"from":{"id":123456789` - this is the user ID
4. Add these IDs to your `.env` file (comma-separated)

### 5. Set Up Webhook (using ngrok)

```bash
# Install ngrok if you haven't already
# Download from https://ngrok.com/download

# Start ngrok
ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Update WEBHOOK_URL in your .env file
```

### 6. Install Dependencies & Start Server

```bash
# Install dependencies (already done)
npm install

# Start the server
npm start

# Or for development with auto-restart:
npm run dev
```

The server will automatically set the webhook when it starts!

## Testing Your Bot

1. Open Telegram and search for your bot by username
2. Click "Start" or send `/start`
3. Follow the prompts to create a test issue
4. Support staff can reply with commands like:
   - `ACK ISSUE-20260105-0001`
   - `ONGOING ISSUE-20260105-0001`
   - `RESOLVED ISSUE-20260105-0001`

## Features Maintained

All original features are preserved:

✅ Step-by-step issue creation flow  
✅ Department, category, and urgency selection  
✅ Issue tracking with unique IDs  
✅ SQLite database storage  
✅ Support group notifications  
✅ Status update commands (ACK, ONGOING, RESOLVED)  
✅ Employee notifications on status changes  
✅ Permission management  
✅ Conversation state management  

## Telegram-Specific Features

🆕 `/start` command to begin interaction  
🆕 Native Telegram keyboard buttons  
🆕 Works in both private chats and groups  
🆕 Better message threading support  

## Troubleshooting

### Bot doesn't respond
- Check if webhook is set: `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
- Verify `TELEGRAM_BOT_TOKEN` is correct
- Ensure ngrok is running and `WEBHOOK_URL` matches

### Messages not reaching support group
- Verify bot is added to the group
- Check `SUPPORT_GROUP_ID` is correct (should be negative number)
- Make sure bot has permission to send messages in the group

### User authorization errors
- Update `SUPPORT_STAFF_IDS` and `EMPLOYEE_IDS` with Telegram user IDs
- Leave `EMPLOYEE_IDS` empty to allow all users

## API Documentation

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api)

## Need Help?

The bot architecture remains the same as before:
- `server.js` - Main entry point, webhook handling
- `telegramService.js` - Telegram API wrapper
- `messageHandler.js` - Message routing and processing
- `conversationManager.js` - Conversation state management
- `issueManager.js` - Database operations
- `permissionsManager.js` - Authorization checks

Happy helping! 🚀
