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
- [ ] Proyecto FastAPI inicializado (`main.py` con health check `/health`)
- [ ] `config.py` con pydantic-settings; `.env.example`
- [ ] PostgreSQL 15 + Redis 7 vía Docker Compose
- [ ] SQLAlchemy configurado; base de modelos
- [ ] Logging estructurado (structlog)
- [ ] pytest configurado con un test de humo
- [ ] Pre-commit hooks: black, isort, flake8, mypy
- [ ] Dockerfile multi-stage

### Frontend
- [ ] Next.js 14 (App Router) + TypeScript
- [ ] Tailwind con los tokens del `REQUERIMIENTOS.md` (paleta azul, verde CTA `#16A34A`, verde WhatsApp `#25D366`)
- [ ] Fuentes Rubik (headings) + Nunito Sans (body)
- [ ] shadcn/ui base: button, card, input, dialog
- [ ] ESLint + Prettier
- [ ] Jest + React Testing Library
- [ ] Dockerfile

### Impeccable (design system) ⭐
- [ ] `npx impeccable install` en el repo frontend
- [ ] `/impeccable init` ejecutado
- [ ] **`PRODUCT.md`** escrito: usuarios (compradores/vendedores de San Juan, mayoría en celular, contacto por WhatsApp), propósito, principios (calm by default, una acción por pantalla, mobile-first)
- [ ] **`DESIGN.md`** escrito: color (nuestra paleta), tipografía (Rubik/Nunito Sans, escalas), shape (radios, borders), componentes base
- [ ] `/impeccable hooks on` — hook PostToolUse + Stop aprobados en el harness
- [ ] Verificado: el detector corre sin API key y devuelve findings

### Infraestructura
- [ ] `docker-compose.yml` disponible como **opción de despliegue** (no requisito de dev)
- [ ] Nginx reverse proxy básico (para despliegue)
- [ ] README con instrucciones de setup
- [ ] `.gitignore` completo
- [ ] GitHub Actions: job de test (pytest+flake8) y build de frontend
- [ ] **CI corre `impeccable audit`** sobre el frontend

---

## ✅ Criterios de Aceptación

### Funcional
- [ ] `uvicorn` (backend) y `next dev` (frontend) corren contra Postgres y Redis **locales** (nativos, sin Docker)
- [ ] `GET /health` responde 200 en backend
- [ ] `GET /health/ready` responde `{"database":"ok","redis":"ok"}` contra Postgres y Redis locales
- [ ] Landing mínima renderiza en `localhost:3000` con las fuentes y colores correctos

> **Entorno nativo (sin Docker).** El desarrollo corre directo sobre Postgres y
> Redis instalados en la máquina. Docker queda como **nota de despliegue
> opcional**, no como criterio de aceptación.

### CI/CD
- [ ] Un PR de prueba dispara el pipeline y pasa (tests + build + audit)
- [ ] Pre-commit bloquea código mal formateado

### Diseño
- [ ] `DESIGN.md` y `PRODUCT.md` existen y reflejan la paleta/tipografía definidas
- [ ] Hooks de Impeccable activos y confirmados por el agente
- [ ] La landing mínima pasa `impeccable audit` con **0 findings P0/P1**

### Documentación
- [ ] README permite a alguien nuevo levantar el proyecto siguiendo solo esos pasos

---

## 🚪 Definition of Done

Todos los criterios anteriores en verde y el stack corriendo local + CI en verde. Recién ahí arranca Fase 1.
