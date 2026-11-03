#!/usr/bin/env bash
# Backup diario de la base (cron: 30 3 * * * /opt/compravendeaqui/backup.sh).
# Guarda 14 días en /opt/compravendeaqui/backups.
set -euo pipefail
cd "$(dirname "$0")"
stamp=$(date +%Y%m%d-%H%M)
docker compose exec -T postgres pg_dump -U compravende -d compravende --format=custom \
  > "backups/compravende-$stamp.dump"
find backups -name 'compravende-*.dump' -mtime +14 -delete
