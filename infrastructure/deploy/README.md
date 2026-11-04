# Deploy en el VPS (Contabo, 173.212.195.122)

CompraVendeAqui comparte el servidor con otras suites pero es **independiente**:
carpeta propia (`/opt/compravendeaqui`), red, volúmenes, Postgres, Redis y
MinIO propios, y ningún puerto publicado en el host.

```
Internet → Caddy de entrada (suite-turnos, :443, HTTPS)
             └─ compravendeaqui.com.ar → compravendeaqui-gateway (Caddy propio)
                    ├─ /api/*, /health*  → compravendeaqui-api  (FastAPI)
                    ├─ /media/*          → compravendeaqui-minio (fotos públicas)
                    └─ resto             → compravendeaqui-web  (Next.js)
```

El único punto de contacto con el resto del servidor es el bloque de
`Caddyfile.edge-snippet` en el Caddy de entrada y la red `suite-turnos_edge`,
a la que solo se conecta el gateway.

## Actualizar

```bash
ssh -i ~/.ssh/suite_turnos_vps -o IdentitiesOnly=yes root@173.212.195.122
cd /opt/compravendeaqui && git -C app pull -q && cp app/infrastructure/deploy/deploy.sh . && ./deploy.sh
```

`deploy.sh` genera los secretos la primera vez (`.env`, `chmod 600`), valida
que ninguno quede vacío, crea el bucket y un usuario de MinIO limitado a él, y
levanta el stack. La API recibe `api.env`, sin las claves root.

## Credenciales de OTP

Completar `WHATSAPP_*` (y opcionalmente `TWILIO_*`) en `/opt/compravendeaqui/.env`
y correr `./deploy.sh` de nuevo.

## Tareas programadas

`/etc/cron.d/compravendeaqui` (archivo propio): backup diario de la base a
`/opt/compravendeaqui/backups` (14 días, solo root) y vencimiento de avisos.

## Restaurar un backup

```bash
cd /opt/compravendeaqui
docker compose exec -T postgres pg_restore -U compravende -d compravende --clean --if-exists < backups/<archivo>.dump
```
