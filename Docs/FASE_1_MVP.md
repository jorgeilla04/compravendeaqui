# 🚀 FASE 1 — MVP Core

> MVP funcional y lanzable: registro por OTP (WhatsApp), publicación de avisos con imágenes y precio USD/ARS, búsqueda full-text, y contacto por WhatsApp. SEO desde el día 1.

**Depende de:** Fase 0

---

## 🎯 Objetivos

- Lanzar MVP que un vendedor real pueda usar de punta a punta.
- Capturar tráfico orgánico local (SEO temprano).
- Base de métricas: clics a WhatsApp = conversión.

---

## 📦 Módulos

### 1.1 Autenticación por OTP telefónico ⭐

**Backend**
- [x] `POST /auth/otp/request` — envía OTP por WhatsApp/SMS
- [x] `POST /auth/otp/verify` — verifica → login o registro
- [x] `POST /auth/register` (email opcional), `POST /auth/login` (password opcional), `refresh`, `logout`, `GET /auth/me` ✅ — `register` completa el perfil tras el primer OTP (una sola vez); refresh rotativo con detección de reuso
- [x] JWT access (15min) + refresh (7 días), tabla `refresh_tokens`
- [x] Rate limiting: 5 intentos → lock 30min; límite de reenvíos de OTP
- [x] Tabla `otp_codes` con expiración y conteo de intentos

**Frontend**
- [x] Pantalla de ingreso por teléfono → OTP (mobile-first)
- [x] Password como método secundario opcional
- [x] Auth context/hook global; rutas protegidas

**Testing**
- [x] Unit del flujo OTP (90%); integración de endpoints; e2e de alta por teléfono

### 1.2 Categorías y Navegación

**Backend**
- [x] `GET /categories` (árbol), `/{slug}`, `/{id}/children`
- [x] Jerarquía parent-child, slugs SEO, caching Redis (1h TTL)

**Frontend**
- [x] Sidebar colapsable (desktop) / drawer (mobile) ✅ — rubros en grilla (home) y chips de subcategorías; filtro de categoría en sidebar (desktop) / drawer (mobile)
- [x] Breadcrumbs; iconos por categoría

### 1.3 Publicación de Avisos ⭐

**Backend**
- [x] CRUD completo de `listings` (soft delete)
- [x] Precio **USD/ARS** con `price_usd_ref` y `fx_rate_at_publish`
- [x] Campo `department` (departamentos de San Juan)
- [x] Upload múltiple de imágenes a S3/MinIO + optimización webp ✅ — webp 1600px + miniatura 480px, sin EXIF/GPS
- [x] Slugs únicos SEO; contador de views; expiración 90 días
- [x] `search_vector` (tsvector español) mantenido por trigger

**Frontend**
- [x] Grid con lazy loading + skeletons
- [x] Detalle de aviso (galería con zoom)
- [x] Formulario de publicación multi-paso (wizard) con preview de imágenes
- [x] Selector de moneda USD/ARS y de departamento
- [x] Editar/eliminar con confirmación

### 1.4 Búsqueda y Filtros

**Backend**
- [x] `GET /search` full-text (PostgreSQL, español, índice GIN)
- [x] Filtros: categoría, precio, **departamento**, condición, moneda
- [x] Orden: relevancia, precio, fecha; paginación cursor-based
- [x] `GET /search/suggestions` (autocomplete)

**Frontend**
- [x] Search bar sticky en header + sugerencias (debounce 300ms)
- [x] Filtros: sidebar (desktop) / drawer (mobile); chips de filtros activos
- [x] Estados: sin resultados, cargando; infinite scroll

### 1.5 Contacto por WhatsApp ⭐

**Backend**
- [x] `POST /listings/{id}/contact` — incrementa `contacts_count`, devuelve deep link `wa.me` con mensaje precargado (título + link del aviso)
- [x] Teléfono del vendedor **resuelto server-side**, nunca en el HTML inicial

**Frontend**
- [x] Botón verde "Contactar por WhatsApp" como CTA primario del aviso
- [x] El teléfono aparece solo tras el clic

### 1.6 Perfil de Usuario

**Backend**
- [x] `GET /users/{id}` (público), `/users/{id}/listings`, `PUT /users/me`, avatar, baja de cuenta (soft delete)

**Frontend**
- [x] Perfil público; edición de perfil; "Mis avisos"; ajustes; baja de cuenta

### 1.7 SEO (temprano) ⭐

- [x] URLs con slug (`/autos/toyota-corolla-2018-xxxx`)
- [x] Meta tags + Open Graph por aviso
- [x] Datos estructurados Schema.org `Product`/`Offer`
- [x] `sitemap.xml` dinámico + `robots.txt`
- [x] SSR/ISR para que Google indexe contenido real

---

## ✅ Criterios de Aceptación MVP

### Funcional
- [ ] Un usuario se registra e ingresa por OTP de WhatsApp — _flujo completo verificado en e2e por la integración real de la Cloud API (contra servidor falso de Meta); falta cargar las credenciales de Meta para enviar mensajes reales_
- [x] Publica un aviso con imágenes y precio en USD o ARS
- [x] Busca y filtra por categoría, precio y departamento
- [x] Contacta al vendedor por WhatsApp (y el clic se cuenta)
- [x] Gestiona sus avisos (editar/eliminar)

### Performance
- [ ] LCP < 2.5s en mobile (Lighthouse) — _medido con Playwright (Pixel 7, 4G lenta, CPU 4x, sin caché): LCP 0,68–0,75 s, CLS 0. Falta correr Lighthouse en staging (no corrió en esta máquina)_
- [x] API p95 < 500ms — ✅ 100 usuarios concurrentes, 6.346 requests, 0 errores, p95 agregado 70 ms (máx. por endpoint 130 ms)
- [ ] Imágenes < 100KB promedio (webp) — _miniaturas (las de las grillas) muy por debajo; verificar el promedio de la foto grande (1600px) con fotos reales_

### Diseño
- [x] Todas las pantallas pasan `impeccable audit` con **0 findings P0/P1** — _públicas escaneadas renderizadas (0 findings); las que requieren sesión, sobre el código fuente_
- [x] Navegación por teclado completa; focus visible — _axe-core (WCAG 2.1 AA) sin violaciones en todas las pantallas, públicas y con sesión, en mobile y desktop; e2e de recorridos solo con teclado (saltar al contenido, buscar, abrir aviso, llegar a WhatsApp, publicar, diálogos). Recomendado: una prueba real con VoiceOver antes del lanzamiento_

### SEO
- [ ] Un aviso renderiza con SSR/ISR e incluye Schema.org válido (test con Rich Results) — _SSR/ISR + JSON-LD Product/Offer/BreadcrumbList testeados; falta pasar la URL de staging por Rich Results Test de Google_
- [x] `sitemap.xml` accesible y correcto

### Seguridad/Legal
- [x] Rate limiting activo; sanitización de inputs; prepared statements
- [x] Teléfono no expuesto antes del clic
- [ ] Términos y Política de Privacidad según Ley 25.326 y 24.240 publicados — _páginas publicadas; falta completar razón social/CUIT/domicilio (`components/legal/legal-page.tsx`) y revisión legal_

### Testing
- [x] Unit > 80%; e2e de los 5 flujos críticos; load test 100 concurrentes — ✅ backend 93 % (86 tests); e2e 5 flujos × mobile/desktop; carga OK (ver arriba)

---

## 🚪 Definition of Done

MVP desplegado en staging, todos los criterios en verde, y listo para cargar los datos reales de proveedores. Este es el punto de lanzamiento inicial.

> **Estado (2026-11-03):** construcción completa y verificada en local. Para cerrar la fase falta: credenciales de Meta (y Twilio opcional), datos legales del titular, deploy a staging y, ahí, Lighthouse + Rich Results Test.
