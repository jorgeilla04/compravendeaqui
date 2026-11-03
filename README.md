# CompraVendeAqui

Plataforma de clasificados y marketplace local para **San Juan, Argentina**.
Reemplazo moderno de `compraensanjuan.com`: mobile-first, contacto por WhatsApp,
precios en ARS y USD, y marco legal argentino.

> **Métrica central:** clics a WhatsApp por aviso (conversión real), no page views.

## Stack

| Capa | Tecnología |
|------|------------|
| Backend | Python 3.13 · FastAPI · SQLAlchemy 2.0 |
| Base de datos | PostgreSQL 15 (full-text nativo, español) |
| Cache / colas | Redis 7 |
| Frontend | Next.js 14 (App Router) · TypeScript · Tailwind · shadcn/ui |

## Estructura

```
Suite_CompraVendeAqui/
├── backend/            # API FastAPI
│   └── app/            # main, config, database, models, api, core, tests
├── frontend/           # Next.js 14 + Tailwind (tokens de DESIGN.md)
├── infrastructure/
│   ├── nginx/          # reverse proxy (para deploy)
│   └── postgres/       # init.sql (extensiones)
├── Docs/               # PRODUCT.md, DESIGN.md, REQUERIMIENTOS.md, plan por fases
└── .github/workflows/  # CI (backend + frontend + design audit)
```

## Puesta en marcha (local, sin contenedores)

Requisitos ya instalados en la máquina: **PostgreSQL** y **Redis** corriendo,
Python 3.11+ y Node 22+.

### 1. Base de datos

Crear la base y las extensiones necesarias (una sola vez):

```bash
createdb compravende
psql -d compravende -f infrastructure/postgres/init.sql
```

### 2. Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt

cp .env.example .env
# Editá DATABASE_URL con tu usuario de Postgres. Ejemplos:
#   trust:  postgresql+psycopg://TU_USUARIO@localhost:5432/compravende
#   clave:  postgresql+psycopg://usuario:clave@localhost:5432/compravende

alembic upgrade head                     # esquema + categorías iniciales
uvicorn app.main:app --reload            # http://localhost:8000
# Si el 8000 está ocupado:  uvicorn app.main:app --reload --port 8001
```

Verificación rápida:

```bash
curl http://localhost:8000/health         # liveness → 200
curl http://localhost:8000/health/ready    # readiness → chequea Postgres + Redis
```

| Recurso | URL |
|---------|-----|
| API | http://localhost:8000 |
| Swagger docs | http://localhost:8000/docs |
| Health | http://localhost:8000/health |

### 3. Integraciones externas

Todas son integraciones reales: se activan completando sus variables en
`backend/.env` (cada una está documentada paso a paso en `.env.example`).
Al arrancar, el backend loguea cuáles están conectadas.

| Integración | Para qué | Variables | Sin configurar |
|-------------|----------|-----------|----------------|
| WhatsApp Cloud API (Meta) | Enviar el código de ingreso (canal principal) | `WHATSAPP_*` | Se usa el siguiente canal |
| Twilio SMS | Respaldo si WhatsApp falla | `TWILIO_*` | Sin ningún canal, el ingreso responde **503** |
| S3 / MinIO / R2 | Fotos de avisos y avatares | `S3_*` | Subir fotos responde **503** |
| DolarApi | Cotización USD/ARS para filtrar y ordenar por precio | `FX_*` | Usa la última cotización conocida |

Fotos en local con MinIO (`brew install minio && brew services start minio`):
completar `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` con las credenciales de
tu MinIO y crear el bucket una vez:

```bash
python -m app.scripts.setup_storage
```

Tareas programadas (cron diario): `python -m app.scripts.expire_listings`
marca como vencidos los avisos de más de 90 días.

### 4. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local     # NEXT_PUBLIC_API_URL apunta al backend
npm run dev                     # http://localhost:3000
```

## Calidad de código

### Backend

```bash
cd backend && source .venv/bin/activate
black app && isort app        # formateo
flake8 app && mypy app        # lint + tipos
pytest                        # tests
```

### Frontend

```bash
cd frontend
npm run lint
npm run type-check
npm test
npm run format
```

### E2E (flujos críticos) y performance

Corren contra un stack aislado (base `compravende_e2e`, Redis 14, MinIO propio
en :9100, backend en :8010, frontend en :3010). El OTP usa la integración real
de WhatsApp Cloud API apuntada a un servidor falso de Meta
(`e2e/fake-meta-server.mjs`) que guarda el código para que Playwright lo lea.

```bash
e2e/start-stack.sh                      # en una terminal
cd frontend
npm run test:e2e                         # 5 flujos × mobile + desktop
npx playwright test --config e2e/perf.config.ts   # LCP/CLS mobile con throttling
```

Prueba de carga (100 usuarios concurrentes):

```bash
SKIP_FRONTEND=1 e2e/start-stack.sh      # en una terminal
source e2e/env.sh && backend/.venv/bin/python loadtest/seed.py 5000
backend/.venv/bin/locust -f loadtest/locustfile.py --host http://localhost:8010 \
  --headless -u 100 -r 20 -t 60s
```

### Pre-commit (bloquea commits mal formateados)

```bash
pip install pre-commit
pre-commit install
pre-commit run --all-files
```

## Sistema de diseño

El frontend respeta [`Docs/DESIGN.md`](Docs/DESIGN.md) (tokens de color, tipografía
Rubik + Nunito Sans, radios, componentes) y [`Docs/PRODUCT.md`](Docs/PRODUCT.md)
(usuarios y principios), con reglas anti-slop. Plan por fases en
[`Docs/PLAN_CONSTRUCCION.md`](Docs/PLAN_CONSTRUCCION.md).

[Impeccable](https://impeccable.style) controla el diseño: el skill y sus hooks
viven en `.claude/` (Claude Code los pide aprobar al abrir la sesión), y el
detector está como devDependency del frontend:

```bash
cd frontend
npx impeccable detect app components          # anti-patrones en el código
npm run build && npx next start -p 3000 &
npx impeccable detect http://localhost:3000   # contraste y reglas de DOM
```

> **DoD de diseño:** ninguna pantalla se da por terminada con findings abiertos.

## CI

GitHub Actions corre en cada push/PR a `main` y `develop`:

- **backend** — black, isort, flake8, mypy, pytest contra Postgres y Redis reales (cobertura mínima 80 %)
- **frontend** — lint, type-check, test, build
- **e2e** — Playwright sobre el stack completo (5 flujos críticos, mobile y desktop)
- **design-audit** — `impeccable detect` sobre el código y sobre la página renderizada; falla con cualquier finding

> Nota: existe un `docker-compose.yml` como opción de despliegue/portabilidad,
> pero el flujo de desarrollo recomendado es local (esta guía).

## Legal

Marco argentino: Ley 25.326 (Protección de Datos, AAIP) y Ley 24.240 (Defensa del
Consumidor). El teléfono del vendedor no se expone hasta el clic de contacto.
