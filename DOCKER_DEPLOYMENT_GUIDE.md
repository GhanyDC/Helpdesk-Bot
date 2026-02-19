# Docker Deployment Guide — Help-Desk Bot (Hardened)

This guide covers deploying the enterprise-hardened Help-Desk Telegram bot with
**PostgreSQL 15**, **Docker Compose**, and full production security controls.

---

## Architecture

```
┌──────────────┐     HTTPS      ┌─────────┐     HTTP       ┌─────────────┐
│   Telegram   │ ─────────────► │  Nginx  │ ─────────────► │  App (Node) │
│   Servers    │                │  :443   │                 │  :3000      │
└──────────────┘                └─────────┘                 └──────┬──────┘
                                                                   │
                                                     private network (no host port)
                                                                   │
                                                            ┌──────▼──────┐
                                                            │ PostgreSQL  │
                                                            │  :5432      │
                                                            │  (pgdata)   │
                                                            └─────────────┘
```

**Security highlights:**
- PostgreSQL port is **not exposed** to the host — only reachable via the private Docker bridge network.
- Webhook path includes a random secret: `/telegram/webhook/<48-char-hex>`.
- App runs as a **non-root** user inside the container.
- `/health` endpoint for monitoring and Docker health checks.
- Structured **winston** JSON logging with file rotation.
- DB-persisted sessions — survives container restarts.

---

## Prerequisites

| Requirement | Minimum |
|---|---|
| Ubuntu | 22.04 LTS (or any Docker-capable OS) |
| Docker Engine | 24+ |
| Docker Compose | v2 (plugin) |
| RAM | 1 GB |
| Open port | 443 (HTTPS for webhook) |

---

## 1. Install Docker

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
docker --version && docker compose version
```

---

## 2. Clone & Configure

```bash
git clone <your-repo-url> ~/helpdesk-bot
cd ~/helpdesk-bot
```

Edit `.env.production` with your actual values:

```bash
nano .env.production
```

### Required variables

| Variable | Description | Example |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Token from @BotFather | `123456:ABC...` |
| `WEBHOOK_URL` | Your public HTTPS URL | `https://bot.example.com` |
| `DB_PASSWORD` | Strong random password (used for both app and Postgres) | `openssl rand -base64 24` |
| `SUPPORT_GROUP_*` | Telegram group chat IDs per branch | `-5294262628` |
| `SUPPORT_STAFF_IDS` | Comma-separated Telegram user IDs | `123,456,789` |

### Important: keep DB passwords in sync

`DB_PASSWORD` and `POSTGRES_PASSWORD` **must match** — the app uses `DB_PASSWORD` to connect, and the Postgres image uses `POSTGRES_PASSWORD` to initialise the database.

```dotenv
DB_PASSWORD=your-strong-password
POSTGRES_PASSWORD=your-strong-password   # Must equal DB_PASSWORD
```

### Optional variables

| Variable | Default | Description |
|---|---|---|
| `WEBHOOK_SECRET` | Auto-generated on startup | Pin a stable webhook path across restarts |
| `NODE_ENV` | `production` (set in compose) | Environment mode |
| `LOG_LEVEL` | `info` | Winston log level (`debug`, `info`, `warn`, `error`) |
| `LOG_DIR` | `/app/logs` | Log file directory inside the container |

> **Tip:** If you leave `WEBHOOK_SECRET` empty, a new random path is generated every
> time the container starts. Pin it once you have set the Telegram webhook.

---

## 3. Build & Start

```bash
docker compose up -d --build
```

Verify:
```bash
docker compose ps
# Both services should show "healthy" / "running"

docker compose logs -f app
# Look for: "Server listening on port 3000"
# Look for: "Database initialized successfully"
```

---

## 4. Set the Telegram Webhook

The webhook URL includes the secret path. Find it in the app logs:

```bash
docker compose logs app | grep "Webhook path"
```

Then register with Telegram:

```bash
WEBHOOK_URL="https://bot.example.com"
SECRET="<the-48-char-hex-from-logs>"

curl -s "https://api.telegram.org/bot<TOKEN>/setWebhook?url=${WEBHOOK_URL}/telegram/webhook/${SECRET}" | jq .
```

Expected: `{ "ok": true, "result": true }`

> **Tip:** After setting the webhook, copy the secret into `WEBHOOK_SECRET=` in
> `.env.production` so it survives container restarts.

---

## 5. Health Check

```bash
# From host
curl -s http://localhost:3000/health | jq .
# { "status": "ok", "uptime": 142.5 }

# Docker health status
docker inspect --format='{{.State.Health.Status}}' helpdesk-bot-app-1
```

The health endpoint checks database connectivity (`SELECT 1`). Returns:
- `200` — healthy
- `503` — database unreachable

---

## 6. Reverse Proxy (Nginx + TLS)

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

`/etc/nginx/sites-available/helpdesk`:

```nginx
server {
    listen 80;
    server_name bot.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/helpdesk /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d bot.example.com
```

---

## 7. Backups

### Automated nightly backup

```bash
chmod +x backup.sh

# Add to cron (runs at 2:00 AM daily)
crontab -e
# Add this line:
0 2 * * * /home/user/helpdesk-bot/backup.sh >> /var/log/helpdesk-backup.log 2>&1
```

The script:
- Dumps the database via `docker compose exec db pg_dump`
- Compresses with gzip into `backups/helpdesk_YYYYMMDD_HHMMSS.sql.gz`
- Prunes backups older than 30 days

### Manual backup

```bash
docker compose exec db pg_dump -U helpdesk helpdesk | gzip > backup_manual.sql.gz
```

### Restore from backup

```bash
gunzip < backups/helpdesk_20260219_020000.sql.gz | \
  docker compose exec -T db psql -U helpdesk -d helpdesk
```

---

## 8. Common Operations

### Logs

```bash
docker compose logs -f app          # Live app logs
docker compose logs -f db           # Live DB logs
docker compose logs --tail 100 app  # Last 100 lines

# Winston log files (inside container)
docker compose exec app cat /app/logs/app.log | tail -20
docker compose exec app cat /app/logs/error.log | tail -20
```

### Restart

```bash
docker compose restart app   # Restart bot only (graceful shutdown)
docker compose restart       # Restart everything
```

### Update

```bash
git pull
docker compose up -d --build
```

### Database shell

```bash
docker compose exec db psql -U helpdesk -d helpdesk
```

### Stop

```bash
docker compose down          # Stop (data preserved in pgdata volume)
docker compose down -v       # Stop AND delete volume (DATA LOSS)
```

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| App exits with "missing required env" | Missing variable in `.env.production` | Check logs: `docker compose logs app` |
| `DB_PASSWORD is required` | `.env.production` not loaded | Ensure `env_file: .env.production` is in compose |
| DB connection refused (retrying) | Postgres not ready yet | Normal — app retries 10x with exponential backoff |
| Webhook 404 | Secret path mismatch | Re-read secret from logs, re-register with Telegram |
| Health check failing | DB unreachable | `docker compose logs db` — check Postgres status |
| Permission denied in container | Docker socket or file perms | App runs as UID 1001; ensure volume mounts are accessible |
| Passwords mismatch error | `DB_PASSWORD != POSTGRES_PASSWORD` | Both must be identical in `.env.production` |

---

## 10. Security Checklist

- [ ] `DB_PASSWORD` is a strong random value (24+ chars)
- [ ] `POSTGRES_PASSWORD` matches `DB_PASSWORD`
- [ ] `WEBHOOK_SECRET` is pinned after first deploy
- [ ] `.env.production` is **not** committed to git
- [ ] PostgreSQL port is **not** published to host
- [ ] Nginx terminates TLS (port 443)
- [ ] Backup cron is active and tested
- [ ] Log rotation is configured (winston + Docker logging driver)
