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

umask 077

# Primera vez: genera el .env con secretos aleatorios.
if [ ! -f .env ]; then
  cp app/infrastructure/deploy/env.production.example .env
  echo "Se generó .env (chmod 600)."
fi
# Completa los secretos que falten (también en un .env de una versión anterior).
set_secret() {
  if ! grep -q "^$1=" .env; then echo "$1=" >> .env; fi
  if grep -q "^$1=$" .env; then sed -i "s|^$1=$|$1=$2|" .env; fi
}
set_secret JWT_SECRET_KEY "$(openssl rand -base64 48 | tr -d '\n/+=')"
set_secret POSTGRES_PASSWORD "$(openssl rand -hex 24)"
set_secret MINIO_ROOT_USER "root$(openssl rand -hex 4)"
set_secret MINIO_ROOT_PASSWORD "$(openssl rand -hex 24)"
set_secret S3_ACCESS_KEY_ID "app$(openssl rand -hex 6)"
set_secret S3_SECRET_ACCESS_KEY "$(openssl rand -hex 24)"
chmod 600 .env
# Fail-closed: ningún secreto puede quedar vacío ni corto.
for v in JWT_SECRET_KEY POSTGRES_PASSWORD MINIO_ROOT_USER MINIO_ROOT_PASSWORD S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY; do
  val=$(sed -n "s|^$v=||p" .env | tr -d '\r')
  case "$v" in
    JWT_SECRET_KEY) min=32 ;;                  # clave de firma
    MINIO_ROOT_USER | S3_ACCESS_KEY_ID) min=8 ;; # nombres de usuario
    *) min=16 ;;                               # contraseñas y claves
  esac
  [ "${#val}" -ge "$min" ] || { echo "ERROR: el secreto $v está vacío o es demasiado corto"; exit 1; }
done
# La API no recibe el root de MinIO ni la contraseña de Postgres por env_file.
grep -v -E '^(MINIO_ROOT_USER|MINIO_ROOT_PASSWORD|POSTGRES_PASSWORD)=' .env > api.env
chmod 600 api.env

# Archivos del stack desde el repo (fuente de verdad).
cp app/infrastructure/deploy/compose.prod.yaml compose.yaml
cp app/infrastructure/deploy/Caddyfile.gateway Caddyfile.gateway
cp app/infrastructure/deploy/minio-app-policy.json minio-app-policy.json
# No es secreto y mc corre sin root dentro del contenedor: tiene que poder leerlo.
chmod 644 minio-app-policy.json
mkdir -p backups && chmod 700 backups

docker compose build --pull
docker compose up -d --wait minio

# MinIO: bucket con lectura pública de las fotos y usuario de la app limitado
# a ese bucket (idempotente).
set -a; . ./.env; set +a
mc() { docker compose exec -T minio mc "$@"; }
mc mb --ignore-existing local/compravende-media >/dev/null
mc anonymous set download local/compravende-media >/dev/null
docker compose cp minio-app-policy.json minio:/tmp/policy.json >/dev/null
mc admin policy create local compravende-app /tmp/policy.json >/dev/null
# El secreto viaja por variable de entorno, no como argumento (no queda en `ps`).
docker compose exec -T -e APP_KEY="$S3_ACCESS_KEY_ID" -e APP_SECRET="$S3_SECRET_ACCESS_KEY" minio \
  sh -c 'mc admin user add local "$APP_KEY" "$APP_SECRET"' >/dev/null
mc admin policy attach local compravende-app --user "$S3_ACCESS_KEY_ID" >/dev/null 2>&1 || true
echo "MinIO: bucket y usuario de la app listos."

docker compose up -d --remove-orphans
docker image prune -f --filter "label=com.docker.compose.project=compravendeaqui" >/dev/null || true
docker compose ps --format "table {{.Name}}\t{{.Status}}"
