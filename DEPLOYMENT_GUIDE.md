# Deployment Guide - Telegram Helpdesk Bot

This guide will help you deploy your Telegram Helpdesk Bot either on your local Windows server or on free cloud platforms.

---

## Option 1: Local Windows Server Deployment (Permanent)

### Prerequisites
- Windows PC that will run 24/7
- Administrative access
- Node.js installed
- Internet connection with public IP or ngrok

### Step 1: Install PM2 (Process Manager)

PM2 keeps your bot running continuously and restarts it automatically if it crashes.

```powershell
npm install -g pm2
npm install -g pm2-windows-startup
```

Configure PM2 to start on Windows startup:

```powershell
pm2-startup install
```

### Step 2: Configure for Production

Update your `.env` file:

```env
# For local server with ngrok (development)
WEBHOOK_URL=https://your-ngrok-url.ngrok-free.app
PORT=3000

# OR for local server with public IP (production)
# WEBHOOK_URL=http://your-public-ip:3000
# PORT=3000
```

### Step 3: Start with PM2

```powershell
cd C:\Users\delac\Downloads\Help-Desk

# Start the bot
pm2 start server.js --name helpdesk-bot

# Save the PM2 process list
pm2 save

# View logs
pm2 logs helpdesk-bot

# View status
pm2 status
```

### Step 4: Setup ngrok Tunnel (if needed)

If you don't have a public IP, use ngrok:

```powershell
# In a separate terminal
ngrok http 3000
```

Then update `WEBHOOK_URL` in `.env` with the ngrok HTTPS URL and restart:

```powershell
pm2 restart helpdesk-bot
```

### Useful PM2 Commands

```powershell
pm2 status              # View bot status
pm2 logs helpdesk-bot   # View logs
pm2 restart helpdesk-bot # Restart bot
pm2 stop helpdesk-bot   # Stop bot
pm2 delete helpdesk-bot # Remove from PM2
pm2 monit               # Real-time monitoring
```

### Windows Firewall Configuration

If using public IP, allow Node.js through Windows Firewall:

1. Open Windows Defender Firewall
2. Click "Allow an app through firewall"
3. Find Node.js or add exception for port 3000

---

## Option 2: Free Cloud Platform Deployment

### 🚀 Render.com (Recommended - Free Tier)

**Advantages:**
- Free tier with 750 hours/month
- Automatic deployments from GitHub
- Built-in HTTPS
- Easy to configure

**Steps:**

1. **Push your code to GitHub**

   Create a `.gitignore` file:
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
   git remote add origin https://github.com/yourusername/helpdesk-bot.git
   git push -u origin main
   ```

2. **Deploy on Render.com**

   - Go to [render.com](https://render.com) and sign up
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Name:** helpdesk-bot
     - **Environment:** Node
     - **Build Command:** `npm install`
     - **Start Command:** `npm start`
     - **Instance Type:** Free

3. **Add Environment Variables**

   In Render dashboard, add all variables from your `.env` file:
   - `TELEGRAM_BOT_TOKEN`
   - `WEBHOOK_URL` (use your Render URL: `https://yourapp.onrender.com`)
   - `SUPPORT_GROUP_JHQ`, `SUPPORT_GROUP_TRK`, etc.
   - All other env variables

4. **Deploy**
   - Click "Create Web Service"
   - Render will automatically deploy your bot

**Note:** Render free tier spins down after 15 minutes of inactivity. First request may take 30-60 seconds to wake up.

---

### 🚂 Railway.app (Free Tier with $5 Credit)

**Advantages:**
- $5 free credit monthly (~217 hours)
- No sleep on inactivity
- Easy deployment
- Built-in database options

**Steps:**

1. **Sign up at [railway.app](https://railway.app)**

2. **Deploy from GitHub:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Railway auto-detects Node.js

3. **Add Environment Variables:**
   - Go to "Variables" tab
   - Add all `.env` variables
   - Get your Railway URL from "Settings" → "Domains"
   - Set `WEBHOOK_URL` to your Railway domain

4. **Deploy:**
   - Railway auto-deploys on push to GitHub

---

### ✈️ Fly.io (Free Tier - 3 VMs)

**Advantages:**
- True free tier (no credit card required initially)
- Runs 24/7 without sleeping
- SQLite database persists with volumes

**Steps:**

1. **Install Fly CLI:**
   ```powershell
   iwr https://fly.io/install.ps1 -useb | iex
   ```

2. **Login and Initialize:**
   ```powershell
   cd C:\Users\delac\Downloads\Help-Desk
   fly auth login
   fly launch
   ```

3. **Configure `fly.toml`:**
   Fly will create this file. Update the `[env]` section:
   ```toml
   [env]
     PORT = "8080"
   ```

4. **Set Secrets:**
   ```powershell
   fly secrets set TELEGRAM_BOT_TOKEN="your-token"
   fly secrets set WEBHOOK_URL="https://yourapp.fly.dev"
   fly secrets set SUPPORT_GROUP_JHQ="-5294262628"
   # ... add all other secrets
   ```

5. **Add Persistent Volume for Database:**
   ```powershell
   fly volumes create helpdesk_data --size 1
   ```

   Update `fly.toml`:
   ```toml
   [mounts]
     source = "helpdesk_data"
     destination = "/app/data"
   ```

6. **Deploy:**
   ```powershell
   fly deploy
   ```

---

### 🎭 Glitch.com (Always-On with Boosted Plan)

**Advantages:**
- Free tier available
- Web-based editor
- Easy remixing and deployment

**Steps:**

1. Go to [glitch.com](https://glitch.com)
2. Click "New Project" → "Import from GitHub"
3. Enter your GitHub repository URL
4. Add environment variables in `.env` editor
5. Glitch automatically runs `npm start`

**Note:** Free tier sleeps after 5 minutes of inactivity. Upgrade to "Boosted" ($8/month) for always-on.

---

## Option 3: Hybrid Approach (Local + Tunnel Service)

For reliable local deployment without port forwarding hassles:

### Using ngrok with Auth Token (Free)

1. **Sign up at [ngrok.com](https://ngrok.com)**
2. **Get your auth token**
3. **Configure ngrok:**
   ```powershell
   ngrok authtoken YOUR_AUTH_TOKEN
   ```

4. **Create ngrok config** (`C:\Users\delac\.ngrok2\ngrok.yml`):
   ```yaml
   version: "2"
   authtoken: YOUR_AUTH_TOKEN
   tunnels:
     helpdesk:
       proto: http
       addr: 3000
       subdomain: your-company-helpdesk  # Only on paid plans
   ```

5. **Start ngrok:**
   ```powershell
   ngrok http 3000
   ```

### Using LocalTunnel (Free Alternative)

```powershell
npm install -g localtunnel

# Start your bot
npm start

# In another terminal
lt --port 3000 --subdomain your-helpdesk-bot
```

---

## Recommended Deployment Strategy

### For Testing/Development:
- **Local PC + ngrok** (simplest, no account needed)

### For Small Team (< 50 users):
- **Local Windows PC + PM2 + ngrok with auth token**
- **OR Fly.io** (best free tier that doesn't sleep)

### For Production (50+ users):
- **Railway.app** (reliable, good free tier)
- **OR Render.com** (easy to use, auto-deploys)
- **OR Local dedicated server with public IP**

---

## Post-Deployment Checklist

✅ **Verify bot is running:**
```powershell
curl https://your-webhook-url.com
```

✅ **Test webhook connection:**
```powershell
curl https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo
```

✅ **Send test message to bot on Telegram**

✅ **Check logs:**
- PM2: `pm2 logs helpdesk-bot`
- Render: Dashboard → Logs tab
- Railway: Dashboard → Deployments → Logs
- Fly.io: `fly logs`

✅ **Verify database persistence:**
- Create a test issue
- Restart the bot
- Check if issue data persists

✅ **Monitor uptime:**
- Set up [UptimeRobot](https://uptimerobot.com) (free) to monitor your webhook URL

---

## Troubleshooting

### Bot not responding
1. Check if server is running: `pm2 status` or check cloud dashboard
2. Verify webhook: Visit `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
3. Check logs for errors

### Database issues
- Ensure `data/` directory exists and is writable
- For cloud: Make sure volume is mounted correctly

### Webhook errors
- Webhook URL must be HTTPS (not HTTP)
- Verify PORT matches your configuration
- Check firewall/security group settings

### ngrok issues
- Free tier URLs change on restart (update `.env` and restart bot)
- Paid tier allows fixed subdomains

---

## Cost Comparison

| Platform | Free Tier | Limitations | Best For |
|----------|-----------|-------------|----------|
| **Local PC + PM2** | Free | Requires PC running 24/7, electricity costs | Full control, no user limits |
| **Render.com** | 750 hrs/month | Spins down after 15 min inactivity | Small teams, low traffic |
| **Railway.app** | $5 credit/month | ~217 hours | Medium traffic, reliable |
| **Fly.io** | 3 VMs free | Limited resources | Always-on, small teams |
| **Glitch** | Free with sleep | Sleeps after 5 min inactivity | Development only |

---

## Next Steps

1. Choose your deployment option
2. Follow the specific deployment steps
3. Update your `.env` with the correct `WEBHOOK_URL`
4. Test the bot thoroughly
5. Monitor logs for any issues
6. Set up backups for your database

**Need Help?** Check the logs first. Most issues are related to:
- Incorrect environment variables
- Webhook URL not matching actual deployment URL
- Missing database permissions
- Firewall blocking connections
