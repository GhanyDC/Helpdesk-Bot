# Enterprise Hardening — Risk & Performance Analysis

## 1. Risk Analysis

### 1.1 Database Availability

| Risk | Mitigation |
|------|-----------|
| PostgreSQL container not ready at app boot | `db.js` retries 10 times with exponential backoff (2 s → 32 s). Docker Compose `depends_on: condition: service_healthy` gate. |
| Connection pool exhaustion under load | Pool capped at 10 connections with 30 s idle timeout. All queries use `pool.query()` (auto-release). No long-held client checkouts. |
| Deadlocks on concurrent writes | Each SQL statement is atomic; only `db.initialize()` uses a multi-statement transaction (schema DDL at boot). Runtime queries are single-statement. |

### 1.2 Session Persistence

| Risk | Mitigation |
|------|-----------|
| In-memory sessions lost on restart | Sessions stored in PostgreSQL `sessions` table with JSONB. Survives container restarts. |
| Stale sessions accumulate | `cleanupExpiredConversations()` runs on every `getConversation()` call, deleting sessions older than 30 minutes via SQL `INTERVAL`. |
| Race condition: two messages from same user | `ON CONFLICT (user_id) DO UPDATE` ensures last-write-wins. Wizard flow is inherently single-user-sequential. |

### 1.3 Security

| Risk | Mitigation |
|------|-----------|
| Webhook endpoint enumeration | Path includes a 48-char hex secret: `/telegram/webhook/<secret>`. Rotates on restart unless `WEBHOOK_SECRET` is pinned in env. |
| Database port exposed to host | `docker-compose.yml` does not publish port 5432. Database accessible only on the private `internal` bridge network. |
| Env variable leakage | `.env.production` excluded from Docker image via `.dockerignore`. `config.js` validates 6 required vars at startup and exits fast on missing values. |
| Container runs as root | Dockerfile creates `appuser:appgroup` (UID 1001). Application and log directory owned by this non-root user. |

### 1.4 Operational

| Risk | Mitigation |
|------|-----------|
| Unhandled promise rejection crashes process | `process.on('unhandledRejection')` and `process.on('uncaughtException')` log the error and call `process.exit(1)`. Docker `restart: always` recovers. |
| Graceful shutdown data loss | SIGTERM/SIGINT handlers stop the scheduler, close the HTTP server (drains in-flight requests), then close the DB pool. |
| Log files fill disk | Winston file transports capped at 5 MB each, rotated to 5 files. Docker json-file driver capped at 10 MB × 3–5 files per service. |
| Backup failure goes unnoticed | `backup.sh` uses `set -euo pipefail`; any pg_dump error exits non-zero. Cron output redirected to a log file for monitoring. |

### 1.5 Startup Ordering

| Risk | Mitigation |
|------|-----------|
| App starts before DB accepts connections | Three-layer defence: (1) Compose `depends_on: condition: service_healthy`, (2) `waitForDatabase()` retry loop in `db.js`, (3) `/health` endpoint returns `503` until DB responds to `SELECT 1`. |
| Schema migration conflicts | DDL is idempotent (`CREATE TABLE IF NOT EXISTS`). Safe to restart multiple times. |

---

## 2. Performance Analysis

### 2.1 Database

| Metric | Value | Notes |
|--------|-------|-------|
| Connection pool size | 10 | Sufficient for a single-bot workload; adjust `DB_POOL_MAX` if needed. |
| Idle timeout | 30 000 ms | Idle connections returned to OS after 30 s. |
| Connect timeout | 5 000 ms | Fast failure on unreachable DB. |
| Session lookup | O(1) index scan | `sessions` table keyed on `user_id` (TEXT PRIMARY KEY). |
| Issue lookup | O(1) index scan | `issues` table keyed on `issue_id` (TEXT PRIMARY KEY). |

### 2.2 Application

| Area | Characteristic |
|------|---------------|
| Webhook latency | Handler always returns 200 immediately, then processes asynchronously via `try/catch`. Telegram will not retry-flood. |
| Session I/O | Single `SELECT` to read, single `INSERT ... ON CONFLICT UPDATE` to write. No joins. Negligible overhead vs. in-memory Map. |
| Logging overhead | Winston JSON serialisation adds ~0.1 ms per log call. File I/O is buffered. |
| Memory footprint | `pendingRemarks` Map is the only in-memory state (TTL 15 min, auto-cleared). All other state is in PostgreSQL. Expected RSS < 80 MB. |

### 2.3 Docker / Infrastructure

| Area | Characteristic |
|------|---------------|
| Image size | ~120 MB (node:18-alpine + production deps only via multi-stage build). |
| Healthcheck interval | 30 s with 10 s timeout, 3 retries, 20 s start period. Balanced between responsiveness and overhead. |
| Log rotation | App logs: 5 MB × 5 files = 25 MB max. Docker logs: 10 MB × 5 files = 50 MB max per service. Total disk ceiling ~150 MB. |
| Backup size | Compressed pg_dump of a typical helpdesk DB (< 10 000 tickets) is < 1 MB. 30-day retention ≈ 30 MB. |
| Startup time | PostgreSQL ready in ~3–5 s. App boot (schema init + role seeding) ~1–2 s after DB is healthy. Total cold start < 10 s. |

### 2.4 Scaling Limits

This architecture is designed for **single-instance internal deployment** (one bot, one database). Known ceilings:

- **~500 concurrent conversations**: Limited by pool size (10) and session table throughput.
- **~50 000 open issues**: Query performance remains fast due to primary key lookups; aggregate stats queries may slow beyond this.
- **Single-node PostgreSQL**: No replication. For HA, consider managed PostgreSQL (e.g., AWS RDS, Azure Database for PostgreSQL).

---

## 3. Hardening Checklist Summary

| # | Requirement | Status |
|---|------------|--------|
| 1 | Structured logging (winston) | ✅ |
| 2 | DB-persisted sessions | ✅ |
| 3 | Role-based users table | ✅ |
| 4 | Webhook secret path | ✅ |
| 5 | `/health` endpoint | ✅ |
| 6 | Docker network isolation | ✅ |
| 7 | No exposed DB port | ✅ |
| 8 | Nightly backup script | ✅ |
| 9 | Env validation at startup | ✅ |
| 10 | Graceful shutdown | ✅ |
| 11 | Unhandled rejection guards | ✅ |
| 12 | Non-root container user | ✅ |
| 13 | Log rotation / disk limits | ✅ |
| 14 | DB connection retry with backoff | ✅ |
| 15 | Docker healthchecks | ✅ |
