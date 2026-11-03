#!/usr/bin/env bash
# Levanta el stack de e2e: fake Meta, MinIO, backend (:8010) y frontend (:3010).
# Uso: e2e/start-stack.sh   (Ctrl+C para cortar todo)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/e2e/env.sh"

psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${E2E_DB}'" | grep -q 1 || createdb "$E2E_DB"
psql -d "$E2E_DB" -qc "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
redis-cli -n 14 flushdb >/dev/null

trap 'kill 0' EXIT
node "$ROOT/e2e/fake-meta-server.mjs" &
mkdir -p "$ROOT/e2e/.minio-data"
minio server "$ROOT/e2e/.minio-data" --address :9100 --console-address :9101 >/dev/null 2>&1 &

cd "$ROOT/backend"
.venv/bin/alembic upgrade head >/dev/null
for _ in $(seq 1 30); do curl -sf localhost:9100/minio/health/live >/dev/null && break; sleep 0.5; done
.venv/bin/python -m app.scripts.setup_storage
.venv/bin/uvicorn app.main:app --port 8010 --log-level warning &

cd "$ROOT/frontend"
if [ "${SKIP_FRONTEND:-0}" != "1" ]; then
  NEXT_PUBLIC_API_URL=http://localhost:8010 NEXT_PUBLIC_SITE_URL=http://localhost:3010 \
    NEXT_PUBLIC_MEDIA_URL=http://localhost:9100 NEXT_DIST_DIR=.next-e2e npm run build >/dev/null
  NEXT_DIST_DIR=.next-e2e npx next start -p 3010 &
fi
wait
