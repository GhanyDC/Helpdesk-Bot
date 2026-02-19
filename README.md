# Telegram Helpdesk Bot

An enterprise-hardened Telegram bot for internal helpdesk support. Employees submit issues through a guided conversational wizard, and support staff manage tickets via inline buttons in branch-specific Telegram groups.

Runs in Docker containers with PostgreSQL, structured logging, DB-persisted sessions, and a secret webhook path.

---

## Features

**Issue Creation Wizard**
- Branch selection (JHQ, TRK, GS, IPIL) — determines routing
- Department selection (Accounting, Sales, HR, Operations, IT, Other) — metadata
- Category (System, Network, Hardware, Software, Access, Other)
- Urgency (Low, Medium, High, Critical)
- Free-text description
- Contact person (or type "ME")
- Confirmation summary with inline buttons before submission

**Ticket Lifecycle**
- Auto-generated Issue IDs: `ISSUE-YYYYMMDD-XXXX`
- Statuses: pending → in-process → resolved / resolved-with-issues → confirmed → closed
- Also: cancelled-staff, cancelled-user
- Full audit trail in `status_history` table
- Support staff must provide remarks when resolving

**Branch-Based Routing**
- Tickets route to the branch support group matching the employee's selected branch
- Optional central monitoring group receives a read-only copy of all tickets
- Central monitoring group is auto-locked (messages deleted)

**Notifications**
- Employees get real-time status updates when support acts
- Support group receives formatted issue cards with inline action buttons

**Permissions & Roles**
- `employee` — can create issues
- `support` — can create issues and update ticket statuses
- `admin` — future use
- Roles seeded from `SUPPORT_STAFF_IDS` env on boot; all other users default to employee

**Scheduled Reports**
- Daily summary at configurable time (default 18:00)
- Weekly summary on Mondays at 09:00
- Auto-close resolved tickets after 7 days

**Enterprise Hardening**
- PostgreSQL 15 with connection pooling (pg)
- DB-persisted wizard sessions (survives container restarts)
- Winston structured JSON logging with file rotation
- Secret webhook path (`/telegram/webhook/<48-char-hex>`)
- `/health` endpoint (checks DB connectivity)
- Env validation at startup — refuses to boot on missing config
- Graceful shutdown (SIGTERM/SIGINT)
- Unhandled rejection / uncaught exception guards
- Docker: non-root user, private network, no exposed DB port, health checks
- Nightly backup script with 30-day retention

---

## Project Structure

```
Help-Desk/
├── server.js                  # Express server, webhook, boot sequence, graceful shutdown
├── config.js                  # Env validation, webhook secret generation
├── constants.js               # Steps, branches, departments, statuses, keywords
├── db.js                      # PostgreSQL pool, retry logic, schema DDL
├── logger.js                  # Winston structured logging (JSON + file rotation)
├── conversationManager.js     # DB-persisted wizard sessions (sessions table)
├── issueManager.js            # Issue CRUD (issues + status_history tables)
├── userIdLogger.js            # User registry + role management (users table)
├── telegramService.js         # Telegram Bot API wrapper
├── messageHandler.js          # Message routing, conversation flow, inline buttons
├── messagingAdapter.js        # Platform abstraction layer
├── permissionsManager.js      # Authorization checks
├── routingService.js          # Branch-based ticket routing + central monitoring
├── schedulerService.js        # Daily/weekly reports, auto-close
├── statsService.js            # On-demand statistics and metrics
├── Dockerfile                 # Multi-stage, node:18-alpine, non-root user
├── docker-compose.yml         # App + PostgreSQL, private network, health checks
├── backup.sh                  # Nightly pg_dump with gzip + rotation
├── .env.production            # Environment config (not committed to git)
├── package.json               # Dependencies
└── utils/
    ├── databaseQueries.js     # Utility SQL queries
    └── getUserIds.js          # User ID discovery helper
```

---

## Prerequisites

| Requirement | Minimum |
|---|---|
| Docker Engine | 24+ |
| Docker Compose | v2 (plugin) |
| RAM | 1 GB |
| Telegram Bot | Created via [@BotFather](https://t.me/botfather) |
| ngrok (dev) or Domain + TLS (prod) | For webhook delivery |

You do **not** need Node.js or PostgreSQL installed locally — Docker handles everything.

---

## Quick Start (Local Development with ngrok)

### 1. Start ngrok

```powershell
ngrok http 3000
```

Copy the HTTPS forwarding URL (e.g. `https://xxxx-xx-xx.ngrok-free.dev`).

> **Important:** Free-tier ngrok URLs change every time you restart ngrok. You must update `WEBHOOK_URL` in `.env.production` and restart the containers each time.

### 2. Configure Environment

Edit `.env.production`:

```dotenv
TELEGRAM_BOT_TOKEN=<your-bot-token>
WEBHOOK_URL=<your-ngrok-https-url>
DB_PASSWORD=<strong-random-password>
POSTGRES_PASSWORD=<same-as-DB_PASSWORD>
SUPPORT_GROUP_JHQ=<telegram-group-id>
SUPPORT_STAFF_IDS=<comma-separated-user-ids>
```

All required variables:

| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Token from @BotFather |
| `WEBHOOK_URL` | Your public HTTPS URL (ngrok or domain) |
| `DB_HOST` | Database host (`db` in Docker) |
| `DB_NAME` | Database name (`helpdesk`) |
| `DB_USER` | Database user (`helpdesk`) |
| `DB_PASSWORD` | Strong random password |
| `POSTGRES_PASSWORD` | **Must match** `DB_PASSWORD` |

### 3. Build & Run

```powershell
docker compose up -d --build
```

Check status:
```powershell
docker compose ps
docker compose logs -f app
```

You should see:
```
Database connection established
Schema initialized
Seeded 5 support staff roles from env
Webhook set  url=https://xxxx.ngrok-free.dev/telegram/webhook/ab12cd34...
Server started  port=3000
```

### 4. Register the Webhook with Telegram

After the app starts, check the logs for the full webhook URL:

```powershell
docker compose logs app | Select-String "Webhook set"
```

The bot automatically calls `setWebhook` on startup. Verify it took effect:

```powershell
Invoke-RestMethod "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

If `last_error_message` is empty and `url` matches your ngrok URL, you're good.

### 5. Test

Open Telegram, find your bot, send `/start` or any message. The bot should reply with a welcome message and start the issue creation wizard.

---

## How to Use the Bot

### Employees — Creating an Issue

1. Open Telegram and message your bot (e.g. @Initial_HelpdeskBot)
2. Send `/start` or any text message
3. The bot walks you through a guided wizard:
   - **Branch** — tap a button (JHQ / TRK / GS / IPIL)
   - **Department** — tap a button (Accounting / Sales / HR / etc.)
   - **Category** — tap a button (System Issue / Network / Hardware / etc.)
   - **Urgency** — tap a button (Low / Medium / High / Critical)
   - **Description** — type a free-text description of the problem
   - **Contact Person** — type a name, or type `ME` to use your own
4. Review the summary card → tap **Confirm** to submit or **Cancel** to discard
5. You receive an Issue ID (e.g. `ISSUE-20260219-0001`)
6. You will be notified automatically whenever support staff update the status

### Employees — Other Commands

| Command | Description |
|---|---|
| `/start` | Welcome message |
| `/help` | Show available commands |
| `/stats` | Your personal issue statistics |
| `/cancel` | Cancel the current wizard mid-flow |
| Any text during wizard | Advances to the next step |

### Support Staff — Managing Tickets

New tickets appear automatically in your branch's support group with inline action buttons.

**Inline buttons on each ticket:**
- **ACK** — Acknowledge (mark as in-process)
- **RESOLVE** — Mark as resolved (bot will ask for remarks)
- **RESOLVE W/ ISSUES** — Resolved with remaining issues
- **CANCEL** — Cancel the ticket

**Text commands (typed in the group or in DM with the bot):**

| Command | Effect |
|---|---|
| `ACK ISSUE-ID` | Acknowledge / mark in-process |
| `ONGOING ISSUE-ID` | Mark as in-process |
| `RESOLVED ISSUE-ID` | Mark as resolved (remarks required) |
| `/status ISSUE-ID <status>` | Set any valid status |
| `/stats` | Show support statistics |
| `/open_issues` | List all open tickets |
| `/my_issues` | Your assigned tickets |

When you tap **RESOLVE**, the bot will prompt you to type remarks explaining the resolution. These are stored on the ticket and sent to the employee.

### Central Monitoring Group (Optional)

If `ENABLE_CENTRAL_MONITORING=true` and `CENTRAL_MONITORING_GROUP` is set, a read-only copy of every ticket is forwarded there. The group is auto-locked so only the bot can post.

---

## Database Schema

### issues

```sql
CREATE TABLE issues (
  issue_id        TEXT PRIMARY KEY,     -- ISSUE-YYYYMMDD-XXXX
  employee_id     TEXT NOT NULL,        -- Telegram user ID
  employee_name   TEXT NOT NULL,
  branch          TEXT,                 -- JHQ / TRK / GS / IPIL
  department      TEXT NOT NULL,
  category        TEXT NOT NULL,
  urgency         TEXT NOT NULL,
  description     TEXT NOT NULL,
  contact_person  TEXT,
  remarks         TEXT,                 -- Support staff resolution remarks
  assigned_to     TEXT,
  assigned_to_name TEXT,
  status          TEXT NOT NULL,
  created_at      TIMESTAMP,
  updated_at      TIMESTAMP,
  resolved_at     TIMESTAMP
);
```

### status_history

```sql
CREATE TABLE status_history (
  id              SERIAL PRIMARY KEY,
  issue_id        TEXT REFERENCES issues(issue_id) ON DELETE CASCADE,
  old_status      TEXT,
  new_status      TEXT NOT NULL,
  updated_by      TEXT NOT NULL,        -- Telegram user ID
  updated_by_name TEXT,
  remarks         TEXT,
  updated_at      TIMESTAMP
);
```

### users

```sql
CREATE TABLE users (
  telegram_id  TEXT PRIMARY KEY,
  username     TEXT,
  first_name   TEXT,
  last_name    TEXT,
  full_name    TEXT,
  chat_id      TEXT,
  role         TEXT CHECK (role IN ('employee', 'support', 'admin')) DEFAULT 'employee',
  first_seen   TIMESTAMP,
  last_seen    TIMESTAMP,
  message_count INTEGER DEFAULT 1
);
```

### sessions

```sql
CREATE TABLE sessions (
  telegram_id TEXT PRIMARY KEY,
  state       TEXT,
  data        JSONB,                    -- Full wizard state
  updated_at  TIMESTAMP
);
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Yes | — | From @BotFather |
| `WEBHOOK_URL` | Yes | — | Public HTTPS URL |
| `DB_HOST` | Yes | — | PostgreSQL host (`db` in Docker) |
| `DB_NAME` | Yes | — | Database name |
| `DB_USER` | Yes | — | Database user |
| `DB_PASSWORD` | Yes | — | Database password |
| `POSTGRES_DB` | Yes | — | Must match `DB_NAME` |
| `POSTGRES_USER` | Yes | — | Must match `DB_USER` |
| `POSTGRES_PASSWORD` | Yes | — | Must match `DB_PASSWORD` |
| `BOT_NAME` | No | `Helpdesk Bot` | Display name |
| `PORT` | No | `3000` | Server port |
| `WEBHOOK_SECRET` | No | Auto-generated | Pin webhook path across restarts |
| `SUPPORT_GROUP_ID` | No | — | Fallback support group |
| `SUPPORT_GROUP_JHQ` | No | — | JHQ branch group |
| `SUPPORT_GROUP_TRK` | No | — | TRK branch group |
| `SUPPORT_GROUP_GS` | No | — | GS branch group |
| `SUPPORT_GROUP_IPIL` | No | — | IPIL branch group |
| `CENTRAL_MONITORING_GROUP` | No | — | Read-only monitoring group |
| `ENABLE_CENTRAL_MONITORING` | No | `false` | Enable/disable monitoring |
| `SUPPORT_STAFF_IDS` | No | — | Comma-separated Telegram user IDs |
| `EMPLOYEE_IDS` | No | — | Employee whitelist (empty = allow everyone) |
| `DAILY_REPORT_HOUR` | No | `18` | Hour for daily report (0-23) |
| `DAILY_REPORT_MINUTE` | No | `0` | Minute for daily report |
| `LOG_LEVEL` | No | `info` | Winston log level (`debug`, `info`, `warn`, `error`) |
| `LOG_DIR` | No | `/app/logs` | Log file directory |

---

## Getting Telegram Credentials

See [TELEGRAM_SETUP.md](TELEGRAM_SETUP.md) for full step-by-step instructions.

**Quick version:**

1. **Create bot** — Message [@BotFather](https://t.me/botfather), send `/newbot`, save the token
2. **Get group IDs** — Add the bot to a group, send a message, visit `https://api.telegram.org/bot<TOKEN>/getUpdates`, find the negative chat ID
3. **Get user IDs** — Users send `/start` to the bot, check `getUpdates` for the `"from":{"id":...}` field

---

## Common Operations

```powershell
# View live logs
docker compose logs -f app

# Restart the bot
docker compose restart app

# Rebuild after code changes
docker compose up -d --build

# Database shell
docker compose exec db psql -U helpdesk -d helpdesk

# Health check
Invoke-RestMethod http://localhost:3000/health

# Stop (data preserved)
docker compose down

# Stop + delete data (DANGER)
docker compose down -v
```

---

## Troubleshooting

### Bot not responding to messages

This is the most common issue. Check these in order:

1. **Is ngrok running?** Free-tier ngrok tunnels shut down when you close the terminal or after inactivity. Restart ngrok and update `WEBHOOK_URL` in `.env.production`, then `docker compose restart app`.

2. **Did the ngrok URL change?** Free ngrok generates a new URL every restart. The webhook URL in `.env.production` must match the current ngrok URL exactly.

3. **Is the webhook registered?** Check:
   ```powershell
   $token = "<YOUR_TOKEN>"
   (Invoke-RestMethod "https://api.telegram.org/bot$token/getWebhookInfo").result | Format-List
   ```
   Look at `last_error_message`. Common errors:
   - **"404 Not Found"** — ngrok tunnel is dead or URL changed
   - **"Wrong response from the webhook"** — ngrok interstitial page or route mismatch
   - **"Connection refused"** — container not running

4. **Is the container healthy?**
   ```powershell
   docker compose ps
   docker compose logs --tail 30 app
   ```

5. **ngrok free-tier interstitial page** — ngrok shows a browser consent page on first visit, which can block Telegram's webhook delivery. Solutions:
   - Use a paid ngrok plan (removes the interstitial)
   - Use an alternative like [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/), [localhost.run](https://localhost.run/), or [bore](https://github.com/ekzhang/bore)
   - Deploy to a VPS with a real domain

### Container keeps restarting

```powershell
docker compose logs --tail 50 app
```

Common causes:
- Missing env variables → `FATAL: Missing required environment variables`
- DB password mismatch → `DB_PASSWORD` and `POSTGRES_PASSWORD` must be identical in `.env.production`
- Port already in use → stop other processes on port 3000

### Webhook 404 after container restart

The webhook path includes a random secret that changes on every restart (unless you pin `WEBHOOK_SECRET`). After first successful boot:
1. Check logs: `docker compose logs app | Select-String "Webhook set"`
2. Copy the hex secret from the URL
3. Add `WEBHOOK_SECRET=<that-hex>` to `.env.production`
4. Restart: `docker compose restart app`

This ensures the webhook path stays stable so you don't need to re-register with Telegram.

### Database connection errors

The app retries database connections 10 times with exponential backoff (2s → 32s). If it still fails:
- Check `docker compose logs db` for PostgreSQL errors
- Verify `DB_PASSWORD` matches `POSTGRES_PASSWORD` in `.env.production`
- Try `docker compose down -v` then `docker compose up -d --build` (resets the database)

### Support commands not working in groups

1. The bot must be an **admin** in the support group to read messages
2. Verify the user's Telegram ID is in `SUPPORT_STAFF_IDS`
3. Commands must include the full issue ID: `ACK ISSUE-20260219-0001`

---

## Development

### Running locally without Docker

Requires Node.js 18+ and a running PostgreSQL instance:

```powershell
npm install

# Create a .env file with DB_HOST=localhost and your local Postgres credentials
npm run dev   # uses nodemon for auto-restart
```

### Viewing logs

In Docker, winston writes JSON logs to `/app/logs/`:
```powershell
docker compose exec app cat /app/logs/app.log
docker compose exec app cat /app/logs/error.log
```

Set `LOG_LEVEL=debug` in `.env.production` for verbose output including webhook payloads and session state changes.

---

## Production Deployment

See [DOCKER_DEPLOYMENT_GUIDE.md](DOCKER_DEPLOYMENT_GUIDE.md) for full instructions including Nginx + TLS, automated backups, and security checklist.

See [RISK_PERFORMANCE_ANALYSIS.md](RISK_PERFORMANCE_ANALYSIS.md) for risk matrix and performance characteristics.

---

## License

ISC

---

**Key Technologies:** Node.js 18, Express, node-telegram-bot-api, PostgreSQL 15, pg, Winston, Docker
