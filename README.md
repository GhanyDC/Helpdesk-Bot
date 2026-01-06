# Telegram Helpdesk Bot

A production-ready Telegram bot for internal helpdesk support requests. Employees can submit issues through a conversational interface, and support staff can manage issues via keyword commands in a central Telegram group.

> **📝 Note:** This project was recently migrated from Viber to Telegram. See [TELEGRAM_SETUP.md](TELEGRAM_SETUP.md) for detailed setup instructions.

## Features

✅ **Step-by-Step Issue Creation**
- Department selection
- Issue category selection
- Urgency level selection
- Detailed description
- Contact person specification
- Confirmation before submission

✅ **Automated Issue Management**
- Unique auto-generated Issue IDs (format: `ISSUE-YYYYMMDD-XXXX`)
- SQLite database for persistent storage
- Status tracking (NEW → ACKNOWLEDGED → ONGOING → RESOLVED)
- Full audit trail of status changes

✅ **Central Support Group Integration**
- New issues automatically posted to support group
- Support staff update status using keywords:
  - `ACK ISSUE-ID` - Acknowledge issue
  - `ONGOING ISSUE-ID` - Mark as work in progress
  - `RESOLVED ISSUE-ID` - Mark as resolved

✅ **Smart Notifications**
- Employees receive automatic status updates
- Real-time notifications when support staff update issues
- Formatted messages with emojis for better UX

✅ **Permission System**
- Employee role: Can create issues only
- Support staff role: Can create issues AND update status
- Configurable whitelist for authorized users

✅ **Session Management**
- Tracks conversation state per user
- 30-minute inactivity timeout
- Automatic cleanup of expired sessions

---

## Project Structure

```
Help-Desk/
├── server.js                  # Main webhook server (entry point)
├── config.js                  # Configuration loader
├── constants.js               # Conversation steps, categories, status values
├── conversationManager.js     # Manages user conversation state
├── issueManager.js            # Issue creation, storage, and retrieval
├── telegramService.js         # Telegram API wrapper
├── permissionsManager.js      # User authorization and roles
├── messageHandler.js          # Message routing and conversation flow
├── package.json               # Dependencies
├── .env                       # Environment variables (create from .env.example)
├── .env.example               # Template for environment variables
└── data/
    └── helpdesk.db           # SQLite database (auto-created)
```

---

## Prerequisites

1. **Node.js** (v14 or higher)
2. **Telegram Bot** - Create via [@BotFather](https://t.me/botfather) on Telegram
3. **ngrok** - For exposing local server to internet during testing

---

## Installation

### 1. Clone or Download the Project

```powershell
cd C:\Users\delac\Downloads\Help-Desk
```

### 2. Install Dependencies

```powershell
npm install
```

This will install:
- `express` - Web server framework
- `node-telegram-bot-api` - Telegram Bot SDK
- `body-parser` - Parse incoming request bodies
- `better-sqlite3` - SQLite database
- `dotenv` - Environment variable management
- `uuid` - UUID generation (future use)

### 3. Create Environment File

Copy the example environment file:

```powershell
Copy-Item .env.example .env
```

### 4. Configure Environment Variables

Open `.env` and fill in the required values:

```env
# Get this from @BotFather on Telegram
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# Bot display info
BOT_NAME=Helpdesk Bot

# Your ngrok URL (update after starting ngrok)
WEBHOOK_URL=https://your-ngrok-url.ngrok.io

# Server port
PORT=3000

# Your central Telegram group/chat ID (negative number for groups)
SUPPORT_GROUP_ID=-1001234567890

# Database path (default is fine)
DB_PATH=./data/helpdesk.db

# Support staff Telegram user IDs (comma-separated)
# To get user IDs: Visit https://api.telegram.org/bot<TOKEN>/getUpdates
SUPPORT_STAFF_IDS=123456789,987654321

# Employee whitelist (leave empty to allow everyone)
EMPLOYEE_IDS=
```

---

## Getting Telegram Bot Credentials

> **🚦 Important:** For detailed step-by-step instructions, see [TELEGRAM_SETUP.md](TELEGRAM_SETUP.md)

### Quick Start

1. **Create Bot via @BotFather**
   - Search for [@BotFather](https://t.me/botfather) on Telegram
   - Send `/newbot` command
   - Follow prompts to create your bot
   - Save the **Bot Token** to `.env` as `TELEGRAM_BOT_TOKEN`

2. **Get Group Chat ID**
   - Create a Telegram group and add your bot
   - Send a message in the group
   - Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Look for `"chat":{"id":-1001234567890` (negative number)
   - Save to `.env` as `SUPPORT_GROUP_ID`

3. **Get User IDs for Permissions**
   - Users send `/start` to your bot
   - Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Look for `"from":{"id":123456789`
   - Add to `.env` as `SUPPORT_STAFF_IDS`

---

## Running the Bot

### 1. Start ngrok

Open a terminal and start ngrok to expose your local server:

```powershell
ngrok http 3000
```

You'll see output like:
```
Forwarding  https://abc123xyz.ngrok.io -> http://localhost:3000
```

Copy the **https** URL (e.g., `https://abc123xyz.ngrok.io`)

### 2. Update Webhook URL

Open `.env` and update:
```env
WEBHOOK_URL=https://abc123xyz.ngrok.io
```

### 3. Start the Bot Server

```powershell
npm start
```

You should see:
```
🤖 Viber Helpdesk Bot Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Server running on port 3000
📍 Webhook: https://abc123xyz.ngrok.io/viber/webhook
🤖 Bot Name: Helpdesk Bot
💾 Database: ./data/helpdesk.db
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 4. Test the Bot

1. Open Viber on your phone or desktop
2. Search for your bot name
3. Start a conversation
4. Send any message to begin creating an issue

---

## Usage Guide

### For Employees

1. **Start Conversation**
   - Send any message to the bot

2. **Follow the Steps**
   - Select your department
   - Choose issue category
   - Select urgency level
   - Describe the issue
   - Provide contact person (or type "ME")

3. **Confirm and Submit**
   - Review the summary
   - Click "✅ Yes, Submit"

4. **Receive Confirmation**
   - You'll get an Issue ID (e.g., `ISSUE-20260105-0001`)
   - You'll receive automatic notifications when support staff update the status

### For Support Staff

1. **View New Issues**
   - New issues are automatically posted to the central support group
   - Each message contains full issue details and the Issue ID

2. **Update Issue Status**
   - Reply in the group or message the bot directly:
     - `ACK ISSUE-20260105-0001` - Acknowledge the issue
     - `ONGOING ISSUE-20260105-0001` - Mark as work in progress
     - `RESOLVED ISSUE-20260105-0001` - Mark as resolved

3. **Employee Notification**
   - When you update status, the employee automatically receives a notification
   - The notification includes the new status and who updated it

---

## Database Schema

### Issues Table

```sql
CREATE TABLE issues (
  issue_id TEXT PRIMARY KEY,           -- e.g., ISSUE-20260105-0001
  employee_id TEXT NOT NULL,           -- Viber user ID
  employee_name TEXT NOT NULL,         -- Employee name
  department TEXT NOT NULL,            -- Department
  category TEXT NOT NULL,              -- Issue category
  urgency TEXT NOT NULL,               -- Low/Medium/High/Critical
  description TEXT NOT NULL,           -- Issue description
  contact_person TEXT,                 -- Contact person name
  status TEXT NOT NULL,                -- NEW/ACKNOWLEDGED/ONGOING/RESOLVED
  created_at DATETIME,                 -- Creation timestamp
  updated_at DATETIME,                 -- Last update timestamp
  resolved_at DATETIME                 -- Resolution timestamp
);
```

### Status History Table

```sql
CREATE TABLE status_history (
  id INTEGER PRIMARY KEY,
  issue_id TEXT NOT NULL,              -- Reference to issues table
  old_status TEXT,                     -- Previous status
  new_status TEXT NOT NULL,            -- New status
  updated_by TEXT NOT NULL,            -- Viber ID of updater
  updated_by_name TEXT,                -- Name of updater
  updated_at DATETIME                  -- Update timestamp
);
```

---

## Module Descriptions

### 1. `server.js` - Main Entry Point
- Sets up Express server
- Configures Viber webhook
- Handles bot events (subscribed, message_received, etc.)
- Manages graceful shutdown

### 2. `config.js` - Configuration Management
- Loads environment variables from `.env`
- Exports configuration objects
- Handles missing configuration gracefully

### 3. `constants.js` - Application Constants
- Conversation steps (DEPARTMENT, CATEGORY, etc.)
- Department options
- Issue categories
- Urgency levels
- Issue status values
- Support keywords

### 4. `conversationManager.js` - State Management
- Tracks active conversations per user
- Stores conversation data (department, category, etc.)
- Manages session timeouts (30 minutes)
- Provides methods to start, update, and end conversations

### 5. `issueManager.js` - Issue Database Operations
- Initializes SQLite database
- Generates unique Issue IDs
- Creates and retrieves issues
- Updates issue status
- Logs status change history
- Provides query methods with filters

### 6. `viberService.js` - Viber API Wrapper
- Wraps Viber Bot SDK methods
- Sends text messages
- Sends keyboard menus (buttons)
- Sends group messages
- Formats issue notifications
- Provides pre-built keyboards for each conversation step

### 7. `permissionsManager.js` - Authorization
- Manages support staff and employee lists
- Checks if users can create issues
- Checks if users can update status
- Provides authorization methods
- Supports adding/removing users dynamically

### 8. `messageHandler.js` - Message Routing
- Routes incoming messages
- Handles conversation flow
- Processes support commands (ACK, ONGOING, RESOLVED)
- Validates user input at each step
- Submits issues to database
- Sends notifications

---

## Development Tips

### Running in Development Mode

Install nodemon for auto-restart on file changes:

```powershell
npm install --save-dev nodemon
```

Then run:

```powershell
npm run dev
```

### Viewing Database Content

You can use any SQLite browser or command-line tool:

```powershell
# Using sqlite3 CLI (if installed)
sqlite3 data/helpdesk.db "SELECT * FROM issues;"
```

Or use a GUI tool like:
- [DB Browser for SQLite](https://sqlitebrowser.org/)
- [SQLiteStudio](https://sqlitestudio.pl/)

### Debugging

Enable detailed logging by adding console.log statements in:
- `messageHandler.js` - See message flow
- `conversationManager.js` - See state changes
- `issueManager.js` - See database operations

---

## Future Enhancements

Here are some ideas for extending the bot:

1. **Export to Google Sheets**
   - Automatically sync issues to a Google Sheet
   - Use Google Sheets API

2. **Email Notifications**
   - Send email to support team when critical issues are created
   - Use Nodemailer or SendGrid

3. **File Attachments**
   - Allow employees to attach screenshots
   - Store in cloud storage (AWS S3, Google Drive)

4. **Search and List Commands**
   - `/myissues` - List user's issues
   - `/search <keyword>` - Search issues
   - `/stats` - Show statistics

5. **Escalation Rules**
   - Auto-escalate HIGH priority issues after X hours
   - Send reminders to support group

6. **Web Dashboard**
   - Build a simple web interface to view all issues
   - Use Express + a template engine (EJS, Pug)

7. **Admin Commands**
   - `/addstaff <user_id>` - Add support staff
   - `/removestaff <user_id>` - Remove support staff
   - `/stats` - View issue statistics

8. **Multi-language Support**
   - Add language selection
   - Store translations in JSON files

9. **SLA Tracking**
   - Track response time
   - Alert if issues exceed SLA thresholds

10. **Integration with Ticketing Systems**
    - Sync with Jira, Zendesk, Freshdesk
    - Use their APIs

---

## Troubleshooting

### Issue: Webhook not receiving messages

**Solution:**
1. Check if ngrok is running
2. Verify `WEBHOOK_URL` in `.env` is correct
3. Ensure webhook was set successfully (check console on startup)
4. Test webhook manually: `curl https://your-ngrok-url.ngrok.io/viber/webhook`

### Issue: Bot not responding

**Solution:**
1. Check server logs for errors
2. Verify `VIBER_AUTH_TOKEN` is correct
3. Ensure user is authorized (check `EMPLOYEE_IDS` in `.env`)
4. Restart the server

### Issue: Support commands not working

**Solution:**
1. Verify user ID is in `SUPPORT_STAFF_IDS`
2. Check command format: `ACK ISSUE-ID` (with space)
3. Verify Issue ID exists in database
4. Check server logs for error messages

### Issue: Database errors

**Solution:**
1. Ensure `data/` directory exists and is writable
2. Check if SQLite is properly installed
3. Try deleting `data/helpdesk.db` and restarting (will reset all data)

### Issue: Group messages not working

**Solution:**
1. Verify bot is added to the group
2. Get the correct group ID (see "Get Support Group ID" section)
3. Update `SUPPORT_GROUP_ID` in `.env`
4. Restart the server

---

## Security Notes

1. **Keep `.env` secure**
   - Never commit `.env` to version control
   - `.env` is already in `.gitignore`

2. **Authentication Token**
   - Keep your `VIBER_AUTH_TOKEN` secret
   - Regenerate it if exposed

3. **User IDs**
   - Viber user IDs are permanent unique identifiers
   - Don't share them publicly

4. **Database Backups**
   - Regularly backup `data/helpdesk.db`
   - Consider automated backup scripts

5. **Production Deployment**
   - Use environment variables (not `.env` file)
   - Use a proper webhook URL (not ngrok)
   - Consider using PM2 for process management
   - Set up monitoring and logging

---

## Production Deployment

When ready to deploy to production:

1. **Use a VPS or Cloud Server**
   - AWS EC2, DigitalOcean, Azure, etc.
   - Install Node.js on the server

2. **Get a Domain Name**
   - Purchase a domain
   - Point it to your server IP
   - Set up SSL certificate (Let's Encrypt)

3. **Use PM2 for Process Management**
   ```bash
   npm install -g pm2
   pm2 start server.js --name helpdesk-bot
   pm2 startup
   pm2 save
   ```

4. **Set Up Nginx (Optional)**
   - Use as reverse proxy
   - Handle SSL termination

5. **Environment Variables**
   - Don't use `.env` file in production
   - Set environment variables directly on the server

6. **Monitoring**
   - Set up logging (Winston, Morgan)
   - Monitor uptime (UptimeRobot, Pingdom)
   - Set up error tracking (Sentry)

---

## Support

For questions or issues:

1. Check the troubleshooting section above
2. Review the code comments in each module
3. Check Viber Bot API documentation: https://developers.viber.com/docs/api/rest-bot-api/

---

## License

ISC

---

## Credits

Built with ❤️ for internal helpdesk automation

**Key Technologies:**
- Node.js & Express
- Viber Bot SDK
- SQLite (better-sqlite3)
- ngrok (development)

---

**Ready to start?** Follow the installation steps above and you'll have your helpdesk bot running in minutes! 🚀
