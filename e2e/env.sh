# Entorno aislado para e2e y prueba de carga (no toca la base ni el Redis de dev).
export E2E_DB=compravende_e2e
export DATABASE_URL="${E2E_DATABASE_URL:-postgresql+psycopg://localhost:5432/${E2E_DB}}"
export REDIS_URL="redis://localhost:6379/14"
export ENVIRONMENT=test
export CORS_ORIGINS="http://localhost:3010"
export PUBLIC_SITE_URL="http://localhost:3010"
export JWT_SECRET_KEY="e2e-only-secret-e2e-only-secret-e2e-only"
# Ingreso por email (como en producción): envío SMTP real contra el servidor falso.
export LOGIN_METHOD=email
export SMTP_HOST=localhost SMTP_PORT=2525 SMTP_SECURITY=none
export SMTP_USERNAME="" SMTP_PASSWORD=""
export EMAIL_FROM="CompraVendeAqui <no-responder@compravendeaqui.test>"
export WHATSAPP_ACCESS_TOKEN="" TWILIO_ACCOUNT_SID="" TWILIO_AUTH_TOKEN=""
# MinIO propio de e2e (puerto 9100, credenciales de test).
export MINIO_ROOT_USER=e2eadmin MINIO_ROOT_PASSWORD=e2eadmin-secret
export S3_ENDPOINT_URL="http://localhost:9100"
export S3_ACCESS_KEY_ID=e2eadmin S3_SECRET_ACCESS_KEY=e2eadmin-secret
export S3_BUCKET=compravende-e2e
export S3_PUBLIC_BASE_URL="http://localhost:9100/compravende-e2e"
# Límites holgados para que la prueba de carga mida performance, no el rate limit.
export OTP_MAX_SENDS_PER_HOUR=50
export OTP_MAX_REQUESTS_PER_IP_HOUR=10000
export OTP_RESEND_COOLDOWN_SECONDS=1
