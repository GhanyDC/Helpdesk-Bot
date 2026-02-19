#!/bin/bash
# ============================================
# Help-Desk Bot — PostgreSQL Nightly Backup
# ============================================
#
# Usage:
#   chmod +x backup.sh
#   ./backup.sh
#
# Cron (every night at 2:00 AM):
#   0 2 * * * /opt/helpdesk-bot/backup.sh >> /var/log/helpdesk-backup.log 2>&1
#
# Restore:
#   gunzip < backups/helpdesk_20260219_020000.sql.gz | \
#     docker compose exec -T db psql -U helpdesk -d helpdesk

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/backups"
RETENTION_DAYS=30
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/helpdesk_${TIMESTAMP}.sql.gz"

# ── Create backup dir ──────────────────────────────────────────────
mkdir -p "${BACKUP_DIR}"

# ── Dump ────────────────────────────────────────────────────────────
echo "[$(date)] Starting backup..."

docker compose -f "${SCRIPT_DIR}/docker-compose.yml" \
  exec -T db pg_dump -U helpdesk -d helpdesk --no-owner --no-acl \
  | gzip > "${BACKUP_FILE}"

SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date)] Backup complete: ${BACKUP_FILE} (${SIZE})"

# ── Prune old backups ──────────────────────────────────────────────
DELETED=$(find "${BACKUP_DIR}" -name "helpdesk_*.sql.gz" -mtime +${RETENTION_DAYS} -delete -print | wc -l)
if [ "${DELETED}" -gt 0 ]; then
  echo "[$(date)] Pruned ${DELETED} backup(s) older than ${RETENTION_DAYS} days"
fi

echo "[$(date)] Done"
