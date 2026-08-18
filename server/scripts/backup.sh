#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# FIRA Database Backup Script
#
# Usage:
#   Manual:   MONGODB_URI="mongodb://..." ./backup.sh
#   Via cron: 0 2 * * * MONGODB_URI="mongodb://..." /path/to/backup.sh >> /var/log/fira-backup.log 2>&1
#
# Environment:
#   MONGODB_URI     — required, full MongoDB connection string
#   BACKUP_DIR      — optional, defaults to /backups/fira
#   RETENTION_DAYS  — optional, defaults to 30
#
# The script:
#   1. Runs mongodump to a date-stamped directory
#   2. Removes backups older than RETENTION_DAYS
#   3. Exits non-zero on failure (suitable for alerting via cron MAILTO)
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups/fira}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DATE=$(date +%Y-%m-%d)
TARGET="${BACKUP_DIR}/${DATE}"

if [ -z "${MONGODB_URI:-}" ]; then
  echo "[ERROR] MONGODB_URI is not set. Aborting." >&2
  exit 1
fi

echo "[$(date -Iseconds)] Starting backup → ${TARGET}"

mkdir -p "${TARGET}"

mongodump --uri="${MONGODB_URI}" --out="${TARGET}" --quiet

echo "[$(date -Iseconds)] Backup complete. Pruning backups older than ${RETENTION_DAYS} days..."

find "${BACKUP_DIR}" -maxdepth 1 -type d -mtime +${RETENTION_DAYS} -exec rm -rf {} +

echo "[$(date -Iseconds)] Done."
