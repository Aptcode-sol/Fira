#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# FIRA Database Restore Script
#
# Usage:
#   ./restore.sh <backup-date>
#
# Example:
#   MONGODB_URI="mongodb://..." ./restore.sh 2025-01-15
#
# This restores from /backups/fira/YYYY-MM-DD (or BACKUP_DIR/YYYY-MM-DD).
#
# Environment:
#   MONGODB_URI     — required, target MongoDB connection string
#   BACKUP_DIR      — optional, defaults to /backups/fira
#
# CAUTION: This will DROP existing collections before restoring.
#          Always verify the backup date and target database before running.
#
# Restore procedure:
#   1. Stop the application (pm2 stop fira-api)
#   2. Run this script with the desired backup date
#   3. Verify data integrity (spot-check key collections)
#   4. Restart the application (pm2 start fira-api)
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups/fira}"

if [ -z "${1:-}" ]; then
  echo "Usage: ./restore.sh <YYYY-MM-DD>" >&2
  echo "" >&2
  echo "Available backups:" >&2
  ls -1 "${BACKUP_DIR}" 2>/dev/null || echo "  (none found in ${BACKUP_DIR})" >&2
  exit 1
fi

RESTORE_DATE="$1"
SOURCE="${BACKUP_DIR}/${RESTORE_DATE}"

if [ -z "${MONGODB_URI:-}" ]; then
  echo "[ERROR] MONGODB_URI is not set. Aborting." >&2
  exit 1
fi

if [ ! -d "${SOURCE}" ]; then
  echo "[ERROR] Backup not found: ${SOURCE}" >&2
  echo "Available backups:" >&2
  ls -1 "${BACKUP_DIR}" 2>/dev/null || echo "  (none)" >&2
  exit 1
fi

echo "╔══════════════════════════════════════════════╗"
echo "║  FIRA DATABASE RESTORE                      ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  Source: ${SOURCE}"
echo "║  Target: ${MONGODB_URI}"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "WARNING: This will overwrite existing data."
read -p "Continue? [y/N] " confirm

if [ "${confirm}" != "y" ] && [ "${confirm}" != "Y" ]; then
  echo "Aborted."
  exit 0
fi

echo "[$(date -Iseconds)] Restoring from ${SOURCE}..."

mongorestore --uri="${MONGODB_URI}" --drop "${SOURCE}"

echo "[$(date -Iseconds)] Restore complete."
echo ""
echo "Next steps:"
echo "  1. Verify data: mongosh \"${MONGODB_URI}\" --eval 'db.stats()'"
echo "  2. Restart app:  pm2 start fira-api"
