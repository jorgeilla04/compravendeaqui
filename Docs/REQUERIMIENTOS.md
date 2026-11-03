# 📋 Requerimientos Técnicos - Plataforma Compra/Venta Local (San Juan)

## 🎯 Resumen Ejecutivo

Plataforma moderna de clasificados/marketplace local para San Juan que supere a `compraensanjuan.com`, con UX inspirada en MercadoLibre pero **escala y stack ajustados a la realidad local**: contacto por WhatsApp, precios USD/ARS, marco legal argentino y arranque manual con proveedores ya comprometidos.

**Tecnologías principales:**
- **Backend:** Python (FastAPI)
- **Base de Datos:** PostgreSQL (full-text nativo, sin Elasticsearch)
- **Frontend:** Next.js 14+ (React)
- **Infraestructura:** Docker Compose + Nginx + Redis en un VPS (sin K8s/Terraform en MVP)

> **Nota de escala:** el proyecto se dimensiona para decenas de miles de usuarios locales, no para escala regional masiva. Se evita deliberadamente la sobre-ingeniería (K8s, read replicas, Elasticsearch, auto-scaling) hasta que las métricas la justifiquen.

---

## 📊 Análisis de Problemas en Plataformas Legacy

### ❌ Malas Prácticas Identificadas en compraensanjuan.com

#### 1. **Arquitectura Obsoleta**
- [x] Sistema basado en PHP procedural (año 2010)
- [x] URLs no amigables (`b.php?cat=200&orden=QueDes,fchact`)
- [x] Sin separación clara de capas (MVC)
- [x] Carga de página lenta (>3s en móvil)
- [x] Sin API RESTful para consumo móvil

#### 2. **UX/UI Deficiente**
- [x] Diseño no responsive (scroll horizontal en móvil)
- [x] Menú de navegación sobrecargado (27 categorías visibles)
- [x] Sin feedback visual en interacciones
- [x] Botones pequeños (<44px para touch)
- [x] Contraste insuficiente en textos secundarios
- [x] Sin sistema de carga progresiva (skeleton screens)
- [x] Formularios sin validación en tiempo real

#### 3. **Accesibilidad**
- [x] Sin etiquetas ARIA
- [x] Imágenes sin alt text
- [x] Navegación no accesible por teclado
- [x] Sin soporte para modo oscuro

#### 4. **Seguridad**
- [x] Sin rate limiting en endpoints
- [x] Validación del lado del cliente solamente
- [x] Sin protección CSRF explícita
- [x] Exposición de IDs secuenciales en URLs

#### 5. **Oportunidad SEO** ⭐ NUEVO
- [x] compraensanjuan.com rankea por inercia, no por optimización
- [x] Sin datos estructurados (Schema.org Product/Offer)
- [x] Migrar tráfico orgánico local es una ventaja competitiva capturable desde el día 1

---

## 🎨 Diseño UX/UI Moderno (Inspirado en MercadoLibre)

### Sistema de Diseño Generado

#### **Pattern: Marketplace / Directory**
- **Enfoque de conversión:** Barra de búsqueda como CTA principal
- **Reducción de fricción:** Sugerencias de búsquedas populares
- **Colocación de CTA:** Hero Search Bar + Navbar "Publicar artículo"
- **CTA de contacto:** Botón **"Contactar por WhatsApp"** como acción primaria en cada aviso ⭐ NUEVO

#### **Estilo: Vibrant & Block-based**
- **Modo:** Light ✓ Full | Dark ✓ Full
- **Palabras clave:** Bold, energetic, playful, block layout, geometric shapes, high color contrast
- **Performance:** ⚡ Good | **Accesibilidad:** ◐ WCAG 2.1

#### **Paleta de Colores**

| Rol | Hex | Variable CSS |
|-----|-----|--------------|
| Primary | `#2563EB` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#3B82F6` | `--color-secondary` |
| Accent/CTA | `#15803D` (antes `#16A34A`, ajustado por contraste AA — ver DESIGN.md) | `--color-accent` |
| WhatsApp | `#25D366` | `--color-whatsapp` |
| Background | `#EFF6FF` | `--color-background` |
| Foreground | `#1E40AF` | `--color-foreground` |
| Muted | `#E9EFF8` | `--color-muted` |
| Border | `#BFDBFE` | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |
| Ring | `#2563EB` | `--color-ring` |

#### **Tipografía**
- **Heading:** Rubik (Google Fonts)
- **Body:** Nunito Sans (Google Fonts)
- **Mood:** ecommerce, clean, shopping, product, retail, conversion

```css
@import url('https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@300;400;500;600;700&family=Rubik:wght@300;400;500;600;700&display=swap');
```

#### **Efectos Clave**
- Secciones grandes (gaps de 48px+)
- Patrones animados sutiles
- Hover bold (color shift)
- Scroll-snap para categorías
- Tipografía grande (32px+)
- Transiciones 200-300ms

---

## 🏗️ Arquitectura del Sistema

### Diagrama de Componentes (Ajustado a escala local)

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTES                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │   Web    │  │  Móvil   │  │   PWA    │                   │
│  │ Next.js  │  │  (web)   │  │ instalab.│                   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                   │
└───────┼─────────────┼─────────────┼─────────────────────────┘
        └─────────────┴─────────────┘
                      │
                ┌─────▼─────┐
                │ Cloudflare│ (CDN + SSL gratis)
                └─────┬─────┘
                      │
              ┌───────▼───────┐
              │     Nginx     │ (reverse proxy)
              └───────┬───────┘
        ┌─────────────┼─────────────┐
        │             │             │
┌───────▼──────┐┌─────▼─────┐┌──────▼──────┐
│   Next.js    ││  FastAPI  ││   Redis     │
│  SSR/SSG/ISR ││   REST    ││ Cache + Q   │
└──────────────┘└─────┬─────┘└─────────────┘
                      │
              ┌───────▼───────┐
              │  PostgreSQL   │ (single node + backups)
              │  full-text    │
              └───────┬───────┘
                      │
              ┌───────▼───────┐
              │ S3/MinIO      │ (imágenes)
              └───────────────┘
```

> Todo corre en **un VPS con Docker Compose**. Read replicas, particionado y auto-scaling quedan documentados como escalado futuro (ver Fase 3), no como requisito de lanzamiento.

---

## 🗂️ Estructura del Proyecto

```
Suite_CompraVendeAqui/
├── backend/
│   ├── app/
│   │   ├── main.py                 # Entry point FastAPI
│   │   ├── config.py               # Configuración (pydantic-settings)
│   │   ├── database.py             # Conexión DB (SQLAlchemy)
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── listing.py
│   │   │   ├── category.py
│   │   │   ├── message.py
│   │   │   ├── payment.py
│   │   │   └── audit.py            # ⭐ NUEVO
│   │   ├── schemas/
│   │   ├── api/v1/endpoints/
│   │   │   ├── auth.py
│   │   │   ├── listings.py
│   │   │   ├── categories.py
│   │   │   ├── messages.py
│   │   │   ├── users.py
│   │   │   ├── search.py
│   │   │   └── payments.py         # ⭐ NUEVO
│   │   ├── core/
│   │   │   ├── security.py         # JWT, password hashing
│   │   │   ├── whatsapp.py         # ⭐ NUEVO — OTP + deep links
│   │   │   ├── storage.py          # S3/MinIO client
│   │   │   └── utils.py
│   │   ├── services/
│   │   └── tests/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/                       # (estructura Next.js sin cambios)
│
├── infrastructure/
│   ├── docker/
│   │   ├── docker-compose.yml
│   │   └── nginx/nginx.conf
│   └── postgres/init.sql
│
├── docs/
├── .github/workflows/ci.yml
├── README.md
├── REQUERIMIENTOS.md
└── PLAN_CONSTRUCCION.md
```

> Se eliminan del árbol inicial: `terraform/`, `kubernetes/`. Se agregan cuando y si hacen falta.

---

## 🗄️ Modelo de Datos (Completado)

### Entidades Principales

```sql
-- Usuarios
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE,                         -- ahora opcional
    phone VARCHAR(20) UNIQUE NOT NULL,                 -- ⭐ teléfono es el identificador real
    phone_verified BOOLEAN DEFAULT FALSE,              -- ⭐ verificación por WhatsApp/OTP
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255),                        -- opcional si entra por OTP
    full_name VARCHAR(255),
    avatar_url TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    role VARCHAR(20) DEFAULT 'user',                   -- 'user','admin','moderator'
    whatsapp_optin BOOLEAN DEFAULT TRUE,               -- ⭐ consentimiento contacto
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMP                               -- ⭐ soft delete
);

-- Tokens de refresco (la usaba el plan, faltaba definirla)  ⭐ NUEVO
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);

-- Códigos OTP (verificación telefónica)  ⭐ NUEVO
CREATE TABLE otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    purpose VARCHAR(20) NOT NULL,                      -- 'register','login','contact'
    attempts INTEGER DEFAULT 0,
    expires_at TIMESTAMP NOT NULL,
    consumed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_otp_phone ON otp_codes(phone, purpose);

-- Categorías (jerárquicas)
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon_url TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Anuncios/Publicaciones
CREATE TABLE listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    price DECIMAL(14, 2),
    price_currency VARCHAR(3) DEFAULT 'ARS',           -- 'ARS' | 'USD'  ⭐
    price_usd_ref DECIMAL(14, 2),                      -- ⭐ precio normalizado a USD al publicar
    fx_rate_at_publish DECIMAL(14, 4),                 -- ⭐ cotización guardada (contexto inflacionario)
    condition VARCHAR(50),                             -- 'nuevo','usado','reacondicionado'
    location VARCHAR(255),
    department VARCHAR(100),                           -- ⭐ departamento de San Juan (Capital, Rivadavia, etc.)
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    status VARCHAR(20) DEFAULT 'active',               -- 'active','sold','expired','draft','suspended'
    views_count INTEGER DEFAULT 0,
    contacts_count INTEGER DEFAULT 0,                  -- ⭐ clics a WhatsApp (métrica de conversión real)
    is_featured BOOLEAN DEFAULT FALSE,                 -- destacado pago
    featured_until TIMESTAMP,                          -- ⭐ vigencia del destacado
    search_vector TSVECTOR,                            -- ⭐ full-text (faltaba en el schema)
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP                               -- ⭐ soft delete
);

-- Imágenes de anuncios
CREATE TABLE listing_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Conversaciones (hilo) — mensajería interna opcional  ⭐ NUEVO
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES users(id),
    seller_id UUID NOT NULL REFERENCES users(id),
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (listing_id, buyer_id)
);

-- Mensajes (ahora colgados de una conversación)
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,  -- ⭐
    sender_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Favoritos
CREATE TABLE favorites (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, listing_id)
);

-- Reportes/Flagging
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES listings(id),
    reported_by UUID NOT NULL REFERENCES users(id),
    reason VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending',              -- 'pending','reviewed','resolved'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pagos / Monetización  ⭐ NUEVO (schema desde el día 1, se cobra cuando quieras)
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    listing_id UUID REFERENCES listings(id),
    product VARCHAR(40) NOT NULL,                      -- 'featured','bump','store_plan','verified_badge'
    amount DECIMAL(14, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'ARS',
    provider VARCHAR(30) DEFAULT 'mercadopago',        -- MercadoPago primero
    provider_ref VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending',              -- 'pending','approved','rejected','refunded'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_payments_user ON payments(user_id);

-- Auditoría (moderación / acciones admin)  ⭐ NUEVO
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id),
    action VARCHAR(80) NOT NULL,                       -- 'listing.suspend','user.ban', etc.
    entity_type VARCHAR(40),
    entity_id UUID,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);

-- Índices de búsqueda y consulta
CREATE INDEX idx_listings_category ON listings(category_id);
CREATE INDEX idx_listings_status ON listings(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_listings_created ON listings(created_at DESC);
CREATE INDEX idx_listings_location ON listings(latitude, longitude);
CREATE INDEX idx_listings_department ON listings(department);           -- ⭐
CREATE INDEX idx_listings_search ON listings USING GIN(search_vector);  -- ⭐ full-text
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_conversations_seller ON conversations(seller_id);

-- Trigger para mantener search_vector actualizado  ⭐ NUEVO
CREATE TRIGGER trg_listings_search_vector
BEFORE INSERT OR UPDATE ON listings
FOR EACH ROW EXECUTE FUNCTION
  tsvector_update_trigger(search_vector, 'pg_catalog.spanish', title, description);
```

---

## 🔌 API Endpoints

### Autenticación (revisada para OTP telefónico) ⭐
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/auth/otp/request` | Enviar OTP por WhatsApp/SMS |
| POST | `/api/v1/auth/otp/verify` | Verificar OTP → login/registro |
| POST | `/api/v1/auth/register` | Registro (email opcional) |
| POST | `/api/v1/auth/login` | Login con password (opcional) |
| POST | `/api/v1/auth/logout` | Logout |
| POST | `/api/v1/auth/refresh` | Refresh token |
| GET | `/api/v1/auth/me` | Perfil usuario |

### Anuncios (Listings)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/listings` | Listar (paginado/filtrado) |
| GET | `/api/v1/listings/{id}` | Detalle |
| POST | `/api/v1/listings` | Crear |
| PUT | `/api/v1/listings/{id}` | Actualizar |
| DELETE | `/api/v1/listings/{id}` | Eliminar (soft delete) |
| POST | `/api/v1/listings/{id}/images` | Subir imágenes |
| POST | `/api/v1/listings/{id}/contact` | Registrar clic WhatsApp + devolver deep link ⭐ |
| POST | `/api/v1/listings/{id}/toggle-favorite` | Favoritar |
| GET | `/api/v1/users/{id}/listings` | Anuncios de un usuario |

### Categorías
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/categories` | Listar (árbol) |
| GET | `/api/v1/categories/{slug}` | Categoría por slug |
| GET | `/api/v1/categories/{id}/children` | Subcategorías |

### Búsqueda
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/search` | Full-text (PostgreSQL, español) |
| GET | `/api/v1/search/suggestions` | Autocomplete |
| GET | `/api/v1/search/nearby` | Cercanos (geo) |

### Monetización ⭐ NUEVO
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/payments/intent` | Crear preferencia de pago (MercadoPago) |
| POST | `/api/v1/payments/webhook` | Webhook de confirmación |
| GET | `/api/v1/users/me/payments` | Historial de pagos |

### Mensajes (interno, opcional)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/conversations` | Mis conversaciones |
| POST | `/api/v1/conversations/{id}/messages` | Enviar mensaje |
| PUT | `/api/v1/messages/{id}/read` | Marcar leído |

---

## 📱 Contacto por WhatsApp (núcleo del producto) ⭐ NUEVO

En Argentina el contacto real ocurre por WhatsApp, no por inbox interno ni email.

- **CTA primario** en cada aviso: botón verde "Contactar por WhatsApp".
- Genera deep link `https://wa.me/<phone>?text=<mensaje precargado con título+link del aviso>`.
- Cada clic hace `POST /listings/{id}/contact` → incrementa `contacts_count` (métrica de conversión real) y devuelve el link.
- El teléfono del vendedor **no se expone en el HTML** hasta el clic (anti-scraping); se resuelve server-side.
- Mensajería interna queda como alternativa secundaria para quien no quiera dar WhatsApp.

---

## 🔒 Seguridad y Privacidad (marco legal argentino) ⭐ CORREGIDO

### Requerimientos Críticos

1. **Autenticación**
   - JWT: access (15min) + refresh (7 días)
   - OTP telefónico (WhatsApp/SMS) como método principal; password opcional (bcrypt cost 12)
   - Rate limiting: 5 intentos → lock 30min; límite de reenvíos de OTP
   - 2FA opcional (TOTP)

2. **Autorización**
   - RBAC: user, admin, moderator
   - Validación de ownership en cada operación CRUD
   - Toda acción de moderación queda en `audit_log`

3. **Protección de Datos**
   - HTTPS obligatorio (HSTS)
   - CORS restringido a dominios propios
   - CSRF tokens en formularios
   - Sanitización de inputs (XSS)
   - Prepared statements (SQL injection)

4. **Privacidad — Ley argentina**
   - **Ley 25.326 de Protección de Datos Personales** y normativa de la **AAIP** (no GDPR)
   - **Ley 24.240 de Defensa del Consumidor** para términos comerciales
   - Teléfono oculto hasta interacción explícita del comprador
   - Consentimiento explícito para contacto por WhatsApp y para marketing
   - Derecho de acceso, rectificación y supresión de datos (baja de cuenta real)

5. **Moderación**
   - Reporte de avisos + auto-flagging por keywords
   - Panel admin para revisión
   - Auto-expiración a 90 días
   - Registro de todo en `audit_log`

---

## ⚡ Performance y Escalabilidad

### Objetivos de Performance

| Métrica | Objetivo | Herramienta |
|---------|----------|-------------|
| LCP | < 2.5s | Lighthouse |
| FID/INP | < 100ms / < 200ms | Lighthouse |
| CLS | < 0.1 | Lighthouse |
| TTFB | < 200ms | Backend monitoring |
| API p95 | < 500ms | Logs/monitor |
| DB query p95 | < 100ms | pg_stat_statements |

### Estrategias (proporcionadas a la escala)

1. **Frontend:** Next.js Image, code splitting, lazy loading, memoización, ISR para listings, PWA.
2. **Backend:** Redis cache (categorías, listings populares, búsquedas frecuentes), tareas async (emails/imágenes) con Redis queue, versionado de API.
3. **Base de Datos:** índices compuestos, full-text GIN, `EXPLAIN ANALYZE`. **Connection pooling con pgbouncer solo si hace falta.**
4. **Infraestructura:** CDN Cloudflare, Nginx.

> **Escalado futuro (documentado, NO en MVP):** read replicas, particionado por fecha, auto-scaling, Elasticsearch. Se activan por métricas, no por defecto.

---

## 📱 Responsive Design

### Breakpoints

```css
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;
--breakpoint-2xl: 1536px;
```

| Pantalla | Layout |
|----------|--------|
| Mobile (<640px) | 1 columna, bottom nav, menú hamburguesa |
| Tablet (640-1024px) | 2 columnas, filtros en sidebar |
| Desktop (>1024px) | 3-4 columnas, sidebar persistente |

---

## 🔎 SEO (movido a prioridad temprana) ⭐

Es la palanca para capturar el tráfico orgánico de compraensanjuan.com. Se implementa desde Fase 1, no al final.

- URLs amigables con slug (`/autos/toyota-corolla-2018-xxxx`)
- Meta tags dinámicos + Open Graph por aviso
- **Datos estructurados Schema.org** `Product` / `Offer` (rich results)
- `sitemap.xml` dinámico + `robots.txt`
- SSR/ISR para que Google indexe contenido, no un cascarón JS
- Canonical URLs y breadcrumbs estructurados

---

## ♿ Accesibilidad (WCAG 2.1 AA)

- [ ] Contraste 4.5:1 (texto normal), 3:1 (texto grande)
- [ ] Todo interactivo accesible por teclado + focus visible
- [ ] Labels asociados (for/id), alt text, ARIA en icon-buttons
- [ ] Skip links, soporte screen readers (NVDA, VoiceOver)
- [ ] Color nunca como único indicador
- [ ] Zoom 200%, `prefers-reduced-motion`
- [ ] Errores de formulario con `aria-describedby`

---

## 🧪 Testing Strategy

- **Backend:** pytest (unit/integration/e2e), cobertura > 80%
- **Frontend:** Jest + React Testing Library, Playwright (e2e)
- **Pirámide:** 70% unit / 20% integración / 10% e2e

---

## 🚀 Deployment y DevOps

### Entornos

| Entorno | Uso | Auto-deploy |
|---------|-----|-------------|
| Development | Local (docker-compose) | Manual |
| Staging | QA | Automático (rama develop) |
| Production | Live | Automático (rama main, con aprobación) |

### CI/CD (GitHub Actions)
- Job test (pytest + flake8) + build frontend (npm ci + build + test)
- Deploy a staging/prod por rama
- Sin K8s: deploy por `docker compose pull && up -d` vía SSH o runner

### Docker Compose (Development)

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: compravende
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: password
    ports: ["5432:5432"]
    volumes: [postgres_data:/var/lib/postgresql/data]
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
  backend:
    build: ./backend
    ports: ["8000:8000"]
    environment:
      DATABASE_URL: postgresql://admin:password@postgres:5432/compravende
      REDIS_URL: redis://redis:6379
    depends_on: [postgres, redis]
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    depends_on: [backend]
volumes:
  postgres_data:
```

---

## 📊 Analytics y Monitoring (ajustado)

- **Business:** nuevos usuarios/día, listings activos, **clics a WhatsApp (conversión real)**, tiempo promedio de venta
- **Técnico:** error rate 5xx, latencia API, cache hit rate
- **UX:** page load, bounce, search success rate

**Herramientas (livianas):** Plausible o GA4 para analytics, **Sentry** para errores, **UptimeRobot** para uptime. Se deja Prometheus/Grafana/ELK/Jaeger como opción futura, no requisito.

---

## 🎯 KPIs de Éxito

| KPI | Meta (Mes 3) |
|-----|--------------|
| Usuarios registrados | 1,000+ |
| Listings activos | 5,000+ (seed propio con proveedores) |
| Clics a WhatsApp / aviso | métrica principal de conversión |
| Time to publish | < 3 min |
| Tráfico móvil | > 60% |
| Page load (mobile) | < 3s |
| Error rate | < 1% |
| Uptime | > 99.5% |

---

## ✅ Checklist Pre-Lanzamiento

### Funcionalidad
- [ ] Registro/login por OTP (WhatsApp)
- [ ] Publicar aviso con imágenes y precio USD/ARS
- [ ] Búsqueda y filtros (incl. por departamento)
- [ ] Botón Contactar por WhatsApp funcionando + conteo
- [ ] Perfil editable, favoritos, reporte de avisos
- [ ] Destacados pagos (schema listo, cobro activable)

### Performance / SEO
- [ ] Lighthouse > 90 (mobile)
- [ ] API p95 < 500ms
- [ ] sitemap.xml + Schema.org Product/Offer
- [ ] Caching implementado

### Seguridad / Legal
- [ ] SSL, rate limiting, sanitización, CSRF, XSS, SQLi
- [ ] Términos y Política de Privacidad según Ley 25.326 y 24.240

### Accesibilidad / Testing
- [ ] WCAG 2.1 AA, navegación por teclado, screen readers
- [ ] Unit > 80%, e2e de flujos críticos, load test (100 concurrentes)

---

## 📚 Referencias

- **Legal AR:** Ley 25.326 (Datos Personales), AAIP, Ley 24.240 (Consumidor)
- **UX:** MercadoLibre, Facebook Marketplace
- **Tech:** FastAPI, Next.js, Tailwind, shadcn/ui, PostgreSQL
- **Estándares:** Web Vitals, WCAG 2.1, OWASP Top 10, Schema.org

---

**Última actualización:** 2026-09-24
**Versión:** 2.0 (adaptada a San Juan: WhatsApp, USD/ARS, legal AR, monetización día 1, escala ajustada)
