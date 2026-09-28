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

### 3. Frontend

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

## CI

GitHub Actions corre en cada push/PR a `main` y `develop`:

- **backend** — black, isort, flake8, mypy, pytest
- **frontend** — lint, type-check, test, build
- **design-audit** — Impeccable audit (se activa al instalar Impeccable en el repo)

> Nota: existe un `docker-compose.yml` como opción de despliegue/portabilidad,
> pero el flujo de desarrollo recomendado es local (esta guía).

## Legal

Marco argentino: Ley 25.326 (Protección de Datos, AAIP) y Ley 24.240 (Defensa del
Consumidor). El teléfono del vendedor no se expone hasta el clic de contacto.
