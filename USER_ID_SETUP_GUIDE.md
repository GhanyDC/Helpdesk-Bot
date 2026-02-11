# 🔑 User ID Setup Guide

## Easy User ID Discovery for Support Staff Configuration

This guide explains how to easily get Telegram user IDs for configuring support staff permissions.

---

## 🎯 Overview

The bot now includes **automated user ID discovery** that makes it easy to identify and configure support staff. No more manual API calls or complicated setup!

### ✨ Features

1. **Automatic Logging**: Bot automatically tracks all users who message it
2. **User Commands**: Users can get their own ID with `/whoami`
3. **Admin Commands**: Support staff can see all users with `/list_users`
4. **Console Output**: New users highlighted in console with copy-paste ready format
5. **Database Storage**: All user interactions stored for easy retrieval

---

## 📋 Quick Start

### Step 1: Get Your Own ID

1. **Message the bot** on Telegram (any message will work)
2. **Send the command**: `/whoami`
3. **Copy your User ID** from the response

Example output:
```
👤 YOUR INFORMATION

Name: John Doe
Username: @johndoe

📋 User ID: 1356047756
💬 Chat ID: 1356047756

🔑 Role: Employee
   - Can create issues
   - Cannot update issue status

📊 Statistics:
   Messages Sent: 5
   First Seen: 2/4/2026, 10:30:00 AM
   Last Seen: 2/4/2026, 2:15:00 PM
```

### Step 2: View All Registered Users (Support Staff Only)

If you're already configured as support staff:

1. **Send the command**: `/list_users`
2. **See all users** who have messaged the bot
3. **Copy the IDs** you need

Example output:
```
👥 REGISTERED USERS

Total Users: 5

1. John Doe
   📋 User ID: 1356047756
   👤 Username: @johndoe
   💬 Messages: 12
   🕐 First Seen: 2/4/2026, 10:30:00 AM
   🕐 Last Seen: 2/4/2026, 2:15:00 PM

2. Jane Smith
   📋 User ID: 6749058032
   💬 Messages: 8
   🕐 First Seen: 2/4/2026, 11:00:00 AM
   🕐 Last Seen: 2/4/2026, 1:45:00 PM

━━━━━━━━━━━━━━━━━━━
💡 To add support staff:
Update .env file with:
SUPPORT_STAFF_IDS=1356047756,6749058032
```

### Step 3: Update .env File

1. Open `.env` file in your project
2. Find the `SUPPORT_STAFF_IDS` line
3. Add the user IDs (comma-separated)

```env
# Support Staff Telegram User IDs (comma-separated)
SUPPORT_STAFF_IDS=1356047756,6749058032,9876543210
```

4. **Restart the bot** for changes to take effect

---

## 🖥️ Console Logging

When a **new user** messages the bot for the first time, you'll see this in the console:

```
┌─────────────────────────────────────────────────────────────┐
│ 🆕 NEW USER DETECTED                                        │
├─────────────────────────────────────────────────────────────┤
│ Name: John Doe                                              │
│ User ID: 1356047756                                         │
│ Username: @johndoe                                          │
│ Chat ID: 1356047756                                         │
└─────────────────────────────────────────────────────────────┘

💡 To add as support staff, update .env:
   SUPPORT_STAFF_IDS=1356047756,...
```

Simply **copy the User ID** from the console and add it to your `.env` file.

---

## 🔧 Available Commands

| Command | Who Can Use | Description |
|---------|------------|-------------|
| `/whoami` | Everyone | Get your own user ID and role information |
| `/list_users` | Support Staff Only | See all registered users with their IDs |

---

## 🎓 How It Works

### Database Tracking

The bot maintains a `user_log` table that stores:
- User ID (Telegram's numeric ID)
- Username (@username)
- Full name
- Chat ID
- First seen timestamp
- Last seen timestamp
- Message count

### Automatic Logging

Every time a user sends a message:
1. Bot extracts user information from the message
2. Updates the database (or creates new record)
3. Logs new users to console with highlighted box
4. Tracks interaction statistics

### No Manual API Calls Needed

Previously, you had to:
- Visit `https://api.telegram.org/bot<TOKEN>/getUpdates`
- Find the user in JSON response
- Manually extract the ID

Now, just ask the user to message the bot or use `/whoami`!

---

## 📊 Data Storage

All user data is stored in the same SQLite database as helpdesk issues:

**File**: `./data/helpdesk.db`

**Table**: `user_log`

```sql
-- View all logged users
SELECT * FROM user_log ORDER BY last_seen DESC;

-- Find specific user
SELECT * FROM user_log WHERE full_name LIKE '%John%';

-- Get support staff candidates (active users)
SELECT * FROM user_log 
WHERE message_count > 5 
ORDER BY last_seen DESC;
```

---

## 🔒 Privacy & Security

### What's Stored

- Telegram User ID (numeric)
- Username (if set)
- First and last name (from Telegram profile)
- Interaction timestamps
- Message count

### What's NOT Stored

- Message content
- Location data
- Phone numbers
- Email addresses
- Any personal information beyond what Telegram provides

### Access Control

- **Everyone**: Can see their own information (`/whoami`)
- **Support Staff**: Can see all registered users (`/list_users`)
- **Database**: Only accessible to server administrators

---

## 🚀 Best Practices

### For Admins

1. **Keep Console Open**: When adding new support staff, watch the console for new user notifications
2. **Use `/list_users`**: Regularly check who's using the bot
3. **Verify Identities**: Confirm user identities before granting support staff access
4. **Document Changes**: Keep track of who has support staff permissions

### For Users

1. **Use `/whoami`**: Check your own ID without asking admins
2. **Verify Role**: Confirm your permissions are correct
3. **Report Issues**: If your role is incorrect, contact an admin

---

## 🔧 Troubleshooting

### "User not found in database"

**Cause**: User hasn't messaged the bot yet

**Solution**: Send any message to the bot first, then try `/whoami`

### "/list_users says I'm not support staff"

**Cause**: Your ID isn't in `SUPPORT_STAFF_IDS` in `.env`

**Solution**: 
1. Use `/whoami` to get your ID
2. Ask admin to add your ID to `.env`
3. Restart the bot

### "Bot not responding to commands"

**Cause**: Bot might be down or webhook issue

**Solution**:
1. Check if bot is running (`pm2 status` or check console)
2. Verify webhook is set correctly
3. Check ngrok tunnel is active

---

## 📝 Example Workflow

### Adding a New Support Staff Member

1. **User**: Messages the bot for the first time
   ```
   User: Hi
   ```

2. **Console**: Shows new user notification
   ```
   ┌─────────────────────────────────────────────┐
   │ 🆕 NEW USER DETECTED                        │
   ├─────────────────────────────────────────────┤
   │ Name: Sarah Johnson                         │
   │ User ID: 5551234567                         │
   │ Username: @sarahj                           │
   └─────────────────────────────────────────────┘
   ```

3. **Admin**: Copies ID from console or asks user to send `/whoami`

4. **User**: Gets their own ID
   ```
   User: /whoami
   Bot: 📋 User ID: 5551234567
   ```

5. **Admin**: Updates `.env`
   ```env
   SUPPORT_STAFF_IDS=1356047756,6749058032,5551234567
   ```

6. **Admin**: Restarts bot
   ```bash
   pm2 restart helpdesk-bot
   ```

7. **User**: Tests permissions
   ```
   User: /list_users
   Bot: [Shows all users - command now works!]
   ```

---

## 🎉 Summary

The new user ID discovery system makes it **incredibly easy** to configure support staff:

✅ **No manual API calls**
✅ **No JSON parsing**
✅ **No complicated setup**
✅ **Automatic tracking**
✅ **User-friendly commands**
✅ **Console notifications**

Just have users message the bot and use `/whoami` or `/list_users`!

---

## 📞 Need Help?

If you encounter any issues:

1. Check the console for error messages
2. Verify `.env` configuration
3. Ensure bot is running and webhook is set
4. Test with `/whoami` command
5. Check database: `sqlite3 data/helpdesk.db "SELECT * FROM user_log;"`

---

**Last Updated**: February 4, 2026
**Version**: 1.0.0
