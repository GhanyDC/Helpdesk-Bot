# Quick Start Guide

## 🚀 Get Your Helpdesk Bot Running in 5 Minutes

### Step 1: Install Dependencies (1 min)

```powershell
cd C:\Users\delac\Downloads\Help-Desk
npm install
```

### Step 2: Configure Environment (2 min)

1. Copy the example file:
   ```powershell
   Copy-Item .env.example .env
   ```

2. Open `.env` and add your Viber bot token:
   ```env
   VIBER_AUTH_TOKEN=your-token-from-viber-partners-portal
   ```

3. Leave other settings as default for now (we'll update webhook URL next)

### Step 3: Start ngrok (1 min)

Open a **separate terminal** and run:

```powershell
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

### Step 4: Update Webhook URL

Open `.env` again and update:

```env
WEBHOOK_URL=https://abc123.ngrok.io
```

(Replace with your actual ngrok URL)

### Step 5: Start the Bot (1 min)

```powershell
npm start
```

You should see:
```
🤖 Viber Helpdesk Bot Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Server running on port 3000
📍 Webhook: https://abc123.ngrok.io/viber/webhook
✅ Webhook set successfully
```

### Step 6: Test It! 🎉

1. Open Viber
2. Search for your bot name
3. Send "Hi" to start a conversation
4. Follow the prompts to create an issue

---

## Next Steps

### Configure Support Group (Optional)

1. Create a Viber group
2. Add your bot to the group
3. Temporarily add this to `server.js` line 71 (after `bot.on(BotEvents.MESSAGE_RECEIVED...`):
   ```javascript
   console.log('Chat ID:', response.chatId);
   ```
4. Send a message in the group
5. Copy the Chat ID from the console
6. Add to `.env`:
   ```env
   SUPPORT_GROUP_ID=your-chat-id
   ```
7. Restart the bot

### Add Support Staff Permissions

1. Temporarily add this to `server.js` line 71:
   ```javascript
   console.log('User ID:', response.userProfile.id);
   ```
2. Ask each support person to message the bot
3. Copy their User IDs
4. Add to `.env`:
   ```env
   SUPPORT_STAFF_IDS=user_id_1,user_id_2,user_id_3
   ```
5. Restart the bot

---

## Testing Support Commands

Once you have support staff configured:

1. Create an issue as an employee
2. Note the Issue ID (e.g., `ISSUE-20260105-0001`)
3. As a support staff member, send:
   - `ACK ISSUE-20260105-0001`
   - `ONGOING ISSUE-20260105-0001`
   - `RESOLVED ISSUE-20260105-0001`
4. The employee will receive automatic notifications!

---

## Common Issues

**"VIBER_AUTH_TOKEN is not set"**
- Make sure you created `.env` (not `.env.txt`)
- Check that the token is on the line with no extra spaces

**"Webhook set failed"**
- Verify ngrok is running
- Copy the HTTPS URL (not HTTP)
- Restart the bot after updating WEBHOOK_URL

**"Bot not responding"**
- Check that the bot server is running (green text in console)
- Make sure you're chatting with the correct bot
- Try typing "restart" to clear your session

---

## Need Help?

See the full [README.md](README.md) for:
- Detailed module explanations
- Database schema
- Future enhancement ideas
- Production deployment guide
- Troubleshooting section

---

Happy botting! 🤖✨
