# Deployment Checklist

Use this checklist to ensure smooth deployment of your Telegram Helpdesk Bot.

---

## Pre-Deployment Checklist

### ✅ Code Preparation
- [ ] All dependencies installed (`npm install`)
- [ ] `.env` file configured with correct values
- [ ] `.gitignore` file exists (excludes `node_modules/`, `.env`, `data/*.db`)
- [ ] Tested locally with `npm start`
- [ ] Bot responds to `/start` command
- [ ] Test issue creation works
- [ ] Status updates work in support groups

### ✅ Telegram Bot Configuration
- [ ] Bot created via @BotFather
- [ ] Bot token saved in `.env`
- [ ] Bot added to all branch support groups
- [ ] Bot is GROUP ADMIN in support groups (required for sending messages)
- [ ] Central monitoring group configured (if enabled)
- [ ] Support staff IDs configured

### ✅ Environment Variables Required
```
TELEGRAM_BOT_TOKEN       # From @BotFather
BOT_NAME                 # Your bot name
WEBHOOK_URL              # Your deployment URL (HTTPS required)
PORT                     # Default 3000 (cloud platforms may override)
SUPPORT_GROUP_JHQ        # JHQ branch support group ID
SUPPORT_GROUP_TRK        # TRK branch support group ID
SUPPORT_GROUP_GS         # GS branch support group ID
SUPPORT_GROUP_IPIL       # IPIL branch support group ID
CENTRAL_MONITORING_GROUP # Optional: Central monitoring group ID
ENABLE_CENTRAL_MONITORING # true or false
SUPPORT_STAFF_IDS        # Comma-separated user IDs
DB_PATH                  # Usually ./data/helpdesk.db
```

---

## Local Server Deployment

### ✅ Windows Server Setup
- [ ] Node.js installed (v14+)
- [ ] PM2 installed (`npm install -g pm2`)
- [ ] PM2 Windows startup configured (`pm2-startup install`)
- [ ] `data/` directory created
- [ ] Port 3000 allowed in Windows Firewall (if using public IP)

### ✅ Webhook Setup (choose one)
**Option A: ngrok (Easiest for local)**
- [ ] ngrok installed
- [ ] ngrok account created (optional but recommended)
- [ ] ngrok running: `ngrok http 3000`
- [ ] WEBHOOK_URL updated with ngrok HTTPS URL
- [ ] Bot restarted after URL update

**Option B: Public IP**
- [ ] Router configured for port forwarding (port 3000)
- [ ] DDNS configured (if dynamic IP)
- [ ] WEBHOOK_URL set to `https://your-ip:3000` or `https://your-domain.com`
- [ ] SSL certificate configured (Let's Encrypt)

### ✅ Start with PM2
```powershell
pm2 start server.js --name helpdesk-bot
pm2 save
pm2 status
pm2 logs helpdesk-bot
```

---

## Cloud Platform Deployment

### ✅ Pre-Cloud Steps
- [ ] GitHub account created
- [ ] Repository created on GitHub
- [ ] Code pushed to GitHub
- [ ] `.gitignore` properly configured

### ✅ Render.com Deployment
- [ ] Account created at render.com
- [ ] New Web Service created
- [ ] GitHub repository connected
- [ ] Environment variables added
- [ ] WEBHOOK_URL set to Render URL (https://yourapp.onrender.com)
- [ ] Build Command: `npm install`
- [ ] Start Command: `npm start`
- [ ] Instance Type: Free
- [ ] Deployment successful

### ✅ Railway.app Deployment
- [ ] Account created at railway.app
- [ ] New Project created from GitHub
- [ ] Environment variables added
- [ ] Domain generated
- [ ] WEBHOOK_URL updated with Railway domain
- [ ] Deployment successful

### ✅ Fly.io Deployment
- [ ] Fly CLI installed
- [ ] Fly account created (`fly auth login`)
- [ ] App launched (`fly launch`)
- [ ] Secrets configured (`fly secrets set`)
- [ ] Volume created for database (`fly volumes create`)
- [ ] fly.toml configured
- [ ] App deployed (`fly deploy`)
- [ ] Deployment successful

---

## Post-Deployment Verification

### ✅ Webhook Verification
- [ ] Check webhook status:
  ```
  curl https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo
  ```
- [ ] Verify `url` matches your WEBHOOK_URL
- [ ] Verify `pending_update_count` is 0
- [ ] No error messages in webhook info

### ✅ Bot Testing
- [ ] Bot responds to `/start` command
- [ ] Bot responds to `/help` command
- [ ] Create a test issue (full flow):
  - [ ] Select branch
  - [ ] Select department
  - [ ] Select category
  - [ ] Select urgency
  - [ ] Enter description
  - [ ] Provide contact info
  - [ ] Confirm submission
- [ ] Issue appears in correct support group
- [ ] Issue saved to database
- [ ] Issue gets auto-generated ID (ISSUE-YYYYMMDD-XXXX)

### ✅ Status Update Testing
- [ ] Join the support group as support staff
- [ ] Update issue status: `/status ISSUE-ID in-progress`
- [ ] Verify bot confirms status update
- [ ] Verify employee receives notification
- [ ] Test all status transitions:
  - [ ] pending → in-progress
  - [ ] in-progress → resolved
  - [ ] resolved → closed

### ✅ Central Monitoring (if enabled)
- [ ] Central monitoring group receives issue copy
- [ ] Format is correct
- [ ] All details visible

### ✅ Logs and Monitoring
- [ ] Check deployment logs (no errors)
- [ ] Test database persistence:
  - [ ] Create issue
  - [ ] Restart server/app
  - [ ] Verify issue data still exists
- [ ] Monitor memory usage
- [ ] Monitor CPU usage

---

## Ongoing Maintenance

### ✅ Daily Tasks
- [ ] Check bot is responsive
- [ ] Review logs for errors
- [ ] Verify issues are being created

### ✅ Weekly Tasks
- [ ] Review database size
- [ ] Check uptime statistics
- [ ] Verify daily reports are sent (18:00)
- [ ] Review any bot crashes/restarts

### ✅ Monthly Tasks
- [ ] Backup database file (`data/helpdesk.db`)
- [ ] Review issue statistics
- [ ] Update support staff IDs if needed
- [ ] Check for npm package updates

---

## Troubleshooting Checklist

### ❌ Bot Not Responding
- [ ] Check if server/app is running
- [ ] Check logs for errors
- [ ] Verify webhook URL is correct
- [ ] Verify webhook is set: `/getWebhookInfo`
- [ ] Check if port is accessible
- [ ] Restart bot/app

### ❌ Issues Not Appearing in Groups
- [ ] Verify bot is member of support group
- [ ] Verify bot is GROUP ADMIN in support group
- [ ] Check support group IDs are correct (negative numbers)
- [ ] Check logs for "Failed to send" errors
- [ ] Test with direct chat first

### ❌ Status Updates Not Working
- [ ] Verify user is in SUPPORT_STAFF_IDS
- [ ] Check command format: `/status ISSUE-ID status-value`
- [ ] Verify issue ID exists
- [ ] Check bot has permission to send messages to user
- [ ] Review logs for permission errors

### ❌ Database Errors
- [ ] Check if `data/` directory exists
- [ ] Verify write permissions on directory
- [ ] Check disk space
- [ ] For cloud: Verify volume is mounted correctly
- [ ] Backup and recreate database if corrupted

### ❌ Webhook Errors
- [ ] Webhook URL must be HTTPS (not HTTP)
- [ ] Verify URL is publicly accessible
- [ ] Check SSL certificate is valid
- [ ] For ngrok: Verify tunnel is active
- [ ] Update webhook: `/setWebhook?url=YOUR_URL`

---

## Emergency Procedures

### 🚨 Bot Down
1. Check logs immediately
2. Restart bot/app
3. Verify webhook configuration
4. Test with simple `/start` command
5. Escalate if issue persists > 5 minutes

### 🚨 Database Corruption
1. Stop bot immediately
2. Backup corrupted database
3. Restore from latest backup
4. Or create fresh database (data loss)
5. Restart bot
6. Verify functionality

### 🚨 Token Compromised
1. Revoke token via @BotFather: `/revoke`
2. Generate new token via @BotFather
3. Update `.env` or secrets with new token
4. Restart bot immediately
5. Verify webhook with new token

---

## Success Criteria

✅ **Your deployment is successful when:**
- Bot responds to messages within 2 seconds
- Issues are created and saved to database
- Issues appear in correct support groups
- Status updates work and notify employees
- Bot stays online 24/7 (or during business hours)
- Database persists after restarts
- Logs show no critical errors
- Daily reports are sent at scheduled time

---

## Support

If you encounter issues:
1. Check logs first (`pm2 logs` or cloud dashboard)
2. Review this checklist
3. Consult [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
4. Check [README.md](README.md) for bot features
5. Review Telegram Bot API docs: https://core.telegram.org/bots/api

---

**Last Updated:** February 11, 2026
**Version:** 1.0.0
