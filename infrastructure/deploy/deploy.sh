#!/usr/bin/env bash
# Deploy de CompraVendeAqui en el VPS. Correr en /opt/compravendeaqui.
#   ./deploy.sh            → actualiza el código (main), buildea y levanta
#   ./deploy.sh <rama>     → idem con otra rama
# No toca nada fuera de /opt/compravendeaqui ni contenedores de otras suites.
set -euo pipefail
cd "$(dirname "$0")"
BRANCH="${1:-main}"
REPO="https://github.com/jorgeilla04/compravendeaqui.git"

if [ ! -d app/.git ]; then
  git clone --quiet "$REPO" app
fi
git -C app fetch --quiet origin "$BRANCH"
git -C app checkout --quiet -B "$BRANCH" "origin/$BRANCH"
echo "Código: $(git -C app log --oneline -1)"

# Primera vez: genera el .env con secretos aleatorios.
if [ ! -f .env ]; then
  umask 077
  sed -e "s|^JWT_SECRET_KEY=.*|JWT_SECRET_KEY=$(openssl rand -base64 48 | tr -d '\n/+=')|" \
      -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 24)|" \
      -e "s|^S3_ACCESS_KEY_ID=.*|S3_ACCESS_KEY_ID=compravende$(openssl rand -hex 4)|" \
      -e "s|^S3_SECRET_ACCESS_KEY=.*|S3_SECRET_ACCESS_KEY=$(openssl rand -hex 24)|" \
      app/infrastructure/deploy/env.production.example > .env
  echo "Se generó .env con secretos nuevos (chmod 600)."
fi

# Archivos del stack desde el repo (fuente de verdad).
cp app/infrastructure/deploy/compose.prod.yaml compose.yaml
cp app/infrastructure/deploy/Caddyfile.gateway Caddyfile.gateway
mkdir -p backups

docker compose build --pull
docker compose up -d --remove-orphans
docker image prune -f --filter "label=com.docker.compose.project=compravendeaqui" >/dev/null || true
docker compose ps --format "table {{.Name}}\t{{.Status}}"
