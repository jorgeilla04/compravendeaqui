# 🏗️ FASE 0 — Setup & Foundation

> Fundaciones del proyecto: repositorio, entornos, CI/CD básico, y el sistema de diseño con Impeccable listo antes de escribir una sola pantalla.

**Depende de:** nada

---

## 🎯 Objetivos

- Estructura del proyecto y entorno de desarrollo reproducible.
- Estándares de código y CI que corre en cada PR.
- **Design system operativo:** Impeccable instalado, `DESIGN.md` y `PRODUCT.md` escritos, hooks activos.

---

## 📦 Deliverables

### Backend
- [x] Proyecto FastAPI inicializado (`main.py` con health check `/health`)
- [x] `config.py` con pydantic-settings; `.env.example`
- [x] ~~PostgreSQL 15 + Redis 7 vía Docker Compose~~ → nativos en la máquina (Docker Compose queda para deploy)
- [x] SQLAlchemy configurado; base de modelos
- [x] Logging estructurado (structlog)
- [x] pytest configurado con un test de humo
- [x] Pre-commit hooks: black, isort, flake8, mypy
- [x] Dockerfile multi-stage

### Frontend
- [x] Next.js 14 (App Router) + TypeScript
- [x] Tailwind con los tokens del `REQUERIMIENTOS.md` (paleta azul, verde CTA `#15803D` — ajustado desde `#16A34A` por AA, verde WhatsApp `#25D366`)
- [x] Fuentes Rubik (headings) + Nunito Sans (body)
- [x] shadcn/ui base: button, card, input, dialog
- [x] ESLint + Prettier
- [x] Jest + React Testing Library
- [x] Dockerfile

### Impeccable (design system) ⭐
- [x] `npx impeccable install` (skill + agentes + hooks en `.claude/`, y `impeccable` como devDependency del frontend)
- [x] `/impeccable init` — cubierto: `Docs/PRODUCT.md` y `Docs/DESIGN.md` ya existen y `impeccable context` los carga
- [x] **`PRODUCT.md`** escrito: usuarios (compradores/vendedores de San Juan, mayoría en celular, contacto por WhatsApp), propósito, principios (calm by default, una acción por pantalla, mobile-first)
- [x] **`DESIGN.md`** escrito: color (nuestra paleta), tipografía (Rubik/Nunito Sans, escalas), shape (radios, borders), componentes base
- [ ] `/impeccable hooks on` — hook PostToolUse + Stop aprobados en el harness — _registrados en `.claude/settings.json`; se aprueban al abrir la próxima sesión de Claude Code_
- [x] Verificado: el detector corre sin API key y devuelve findings

### Infraestructura
- [x] `docker-compose.yml` disponible como **opción de despliegue** (no requisito de dev)
- [x] Nginx reverse proxy básico (para despliegue)
- [x] README con instrucciones de setup
- [x] `.gitignore` completo
- [x] GitHub Actions: job de test (pytest+flake8) y build de frontend
- [x] **CI corre `impeccable detect`** sobre el código fuente y sobre la página renderizada (bloquea con findings)

---

## ✅ Criterios de Aceptación

### Funcional
- [x] `uvicorn` (backend) y `next dev` (frontend) corren contra Postgres y Redis **locales** (nativos, sin Docker)
- [x] `GET /health` responde 200 en backend
- [x] `GET /health/ready` responde `{"database":"ok","redis":"ok"}` contra Postgres y Redis locales
- [x] Landing mínima renderiza en `localhost:3000` con las fuentes y colores correctos

> **Entorno nativo (sin Docker).** El desarrollo corre directo sobre Postgres y
> Redis instalados en la máquina. Docker queda como **nota de despliegue
> opcional**, no como criterio de aceptación.

### CI/CD
- [ ] Un PR de prueba dispara el pipeline y pasa (tests + build + audit) — _pendiente: falta permiso de push al repo remoto_
- [x] Pre-commit bloquea código mal formateado

### Diseño
- [x] `DESIGN.md` y `PRODUCT.md` existen y reflejan la paleta/tipografía definidas
- [ ] Hooks de Impeccable activos y confirmados por el agente — _ídem: confirmar en la próxima sesión_
- [x] La landing mínima pasa `impeccable detect` (fuente + página renderizada) con **0 findings**

### Documentación
- [x] README permite a alguien nuevo levantar el proyecto siguiendo solo esos pasos

---

## 🚪 Definition of Done

Todos los criterios anteriores en verde y el stack corriendo local + CI en verde. Recién ahí arranca Fase 1.
