# Quick Cloud Deployment Guide

Choose your preferred platform and follow the steps:

---

## 🚀 Render.com (Easiest - Recommended for Beginners)

### 1. Prepare Your Code

Create `.gitignore`:
```
node_modules/
.env
data/*.db
*.log
```

Push to GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/helpdesk-bot.git
git push -u origin main
```

### 2. Deploy on Render

1. Go to https://render.com and sign up (free)
2. Click **New +** → **Web Service**
3. Connect your GitHub repository
4. Fill in:
   - **Name:** `helpdesk-bot`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`

### 3. Add Environment Variables

In the Render dashboard, click **Environment** and add:

```
TELEGRAM_BOT_TOKEN=7988630093:AAGyUn-0B92cfrD48wjgdVMgIN78r8cR9no
BOT_NAME=Initial_HelpdeskBot
WEBHOOK_URL=https://helpdesk-bot.onrender.com
PORT=3000
SUPPORT_GROUP_JHQ=-5294262628
SUPPORT_GROUP_TRK=-5287143578
SUPPORT_GROUP_GS=-5001636848
SUPPORT_GROUP_IPIL=-5125737666
CENTRAL_MONITORING_GROUP=-1003455355361
ENABLE_CENTRAL_MONITORING=true
DAILY_REPORT_HOUR=18
DAILY_REPORT_MINUTE=0
DB_PATH=./data/helpdesk.db
SUPPORT_STAFF_IDS=1356047756,6749058032,837290674
EMPLOYEE_IDS=
```

**⚠️ Important:** Replace `helpdesk-bot.onrender.com` with YOUR actual Render URL (shown in dashboard)

### 4. Deploy

Click **Create Web Service** - Render will automatically deploy!

### 5. Test

Send a message to your bot on Telegram: https://t.me/Initial_HelpdeskBot

---

## 🚂 Railway.app (Better Performance)

### 1. Prepare Code

Same as Render - push to GitHub with `.gitignore`

### 2. Deploy on Railway

1. Go to https://railway.app and sign up
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your repository
4. Railway auto-detects Node.js

### 3. Add Environment Variables

1. Click on your service → **Variables** tab
2. Click **Raw Editor** and paste:

```
TELEGRAM_BOT_TOKEN=7988630093:AAGyUn-0B92cfrD48wjgdVMgIN78r8cR9no
BOT_NAME=Initial_HelpdeskBot
WEBHOOK_URL=https://YOUR_APP.up.railway.app
PORT=3000
SUPPORT_GROUP_JHQ=-5294262628
SUPPORT_GROUP_TRK=-5287143578
SUPPORT_GROUP_GS=-5001636848
SUPPORT_GROUP_IPIL=-5125737666
CENTRAL_MONITORING_GROUP=-1003455355361
ENABLE_CENTRAL_MONITORING=true
DAILY_REPORT_HOUR=18
DAILY_REPORT_MINUTE=0
DB_PATH=./data/helpdesk.db
SUPPORT_STAFF_IDS=1356047756,6749058032,837290674
EMPLOYEE_IDS=
```

### 4. Generate Domain

1. Go to **Settings** → **Networking**
2. Click **Generate Domain**
3. Copy the domain (e.g., `your-app.up.railway.app`)
4. Update `WEBHOOK_URL` variable with this domain

### 5. Deploy

Railway automatically deploys on push to GitHub!

---

## ✈️ Fly.io (Best Free Tier - No Sleep)

### 1. Install Fly CLI

```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

### 2. Login and Launch

```powershell
cd C:\Users\delac\Downloads\Help-Desk
fly auth login
fly launch --no-deploy
```

Answer the prompts:
- **App name:** helpdesk-bot (or your choice)
- **Region:** Choose closest to you
- **PostgreSQL:** No
- **Redis:** No

### 3. Configure fly.toml

Fly creates `fly.toml`. Update it:

```toml
app = "helpdesk-bot"
primary_region = "sin"  # or your chosen region

[build]

[env]
  PORT = "8080"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 256
```

### 4. Set Secrets

```powershell
fly secrets set TELEGRAM_BOT_TOKEN="7988630093:AAGyUn-0B92cfrD48wjgdVMgIN78r8cR9no"
fly secrets set BOT_NAME="Initial_HelpdeskBot"
fly secrets set WEBHOOK_URL="https://helpdesk-bot.fly.dev"
fly secrets set SUPPORT_GROUP_JHQ="-5294262628"
fly secrets set SUPPORT_GROUP_TRK="-5287143578"
fly secrets set SUPPORT_GROUP_GS="-5001636848"
fly secrets set SUPPORT_GROUP_IPIL="-5125737666"
fly secrets set CENTRAL_MONITORING_GROUP="-1003455355361"
fly secrets set ENABLE_CENTRAL_MONITORING="true"
fly secrets set DAILY_REPORT_HOUR="18"
fly secrets set DAILY_REPORT_MINUTE="0"
fly secrets set DB_PATH="./data/helpdesk.db"
fly secrets set SUPPORT_STAFF_IDS="1356047756,6749058032,837290674"
fly secrets set EMPLOYEE_IDS=""
```

**⚠️ Important:** Replace `helpdesk-bot.fly.dev` with YOUR actual Fly app name

### 5. Create Persistent Volume (for SQLite database)

```powershell
fly volumes create helpdesk_data --size 1 --region sin
```

Update `fly.toml` to add mounts:

```toml
[mounts]
  source = "helpdesk_data"
  destination = "/app/data"
```

### 6. Deploy

```powershell
fly deploy
```

### 7. Check Status

```powershell
fly status
fly logs
```

---

## 📊 Comparison

| Feature | Render | Railway | Fly.io |
|---------|--------|---------|--------|
| **Free Tier** | 750 hrs/month | $5 credit/month | 3 VMs free |
| **Sleep Mode** | Yes (15 min) | No | No |
| **Custom Domain** | Yes | Yes | Yes |
| **Database** | Separate service | Separate service | Volumes (included) |
| **Setup Difficulty** | ⭐ Easy | ⭐⭐ Medium | ⭐⭐⭐ Advanced |
| **Best For** | Beginners | Small teams | Always-on apps |

---

## Recommended Choice

### For Testing/Learning:
👉 **Render.com** - easiest to set up, good for learning

### For Production Use:
👉 **Fly.io** - best free tier, no sleep, persistent storage
👉 **Railway.app** - reliable, good performance

---

## After Deployment

### 1. Verify Webhook

```powershell
curl https://api.telegram.org/bot7988630093:AAGyUn-0B92cfrD48wjgdVMgIN78r8cR9no/getWebhookInfo
```

Should show:
```json
{
  "ok": true,
  "result": {
    "url": "https://your-app-url.com",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

### 2. Test the Bot

1. Open Telegram
2. Search for `@Initial_HelpdeskBot`
3. Send `/start`
4. Create a test issue

### 3. Monitor Logs

- **Render:** Dashboard → Logs
- **Railway:** Dashboard → Deployments → View Logs
- **Fly.io:** `fly logs`

### 4. Set Up Monitoring (Optional)

Use [UptimeRobot](https://uptimerobot.com) (free) to monitor uptime:
1. Sign up at uptimerobot.com
2. Add monitor with your deployment URL
3. Get alerts if bot goes down

---

## Troubleshooting

### Bot Not Responding

1. Check logs for errors
2. Verify webhook: `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
3. Ensure `WEBHOOK_URL` matches actual deployment URL
4. Check if app is sleeping (Render free tier)

### Database Errors

- **Render/Railway:** Database is ephemeral on free tier (data lost on restart)
  - Solution: Upgrade to paid tier or use external database
- **Fly.io:** Ensure volume is properly mounted at `/app/data`

### Environment Variable Issues

- Make sure all required variables are set
- No quotes needed when pasting in dashboards (they're added automatically)
- Restart deployment after changing variables

---

## Need Help?

1. Check deployment logs first
2. Verify all environment variables are set correctly  
3. Test webhook URL is accessible: `curl https://your-url.com`
4. Ensure Telegram bot token is valid
5. Check support group IDs are correct (negative numbers)

Good luck with your deployment! 🚀
