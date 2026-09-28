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
- [ ] `POST /auth/otp/request` — envía OTP por WhatsApp/SMS
- [ ] `POST /auth/otp/verify` — verifica → login o registro
- [ ] `POST /auth/register` (email opcional), `POST /auth/login` (password opcional), `refresh`, `logout`, `GET /auth/me`
- [ ] JWT access (15min) + refresh (7 días), tabla `refresh_tokens`
- [ ] Rate limiting: 5 intentos → lock 30min; límite de reenvíos de OTP
- [ ] Tabla `otp_codes` con expiración y conteo de intentos

**Frontend**
- [ ] Pantalla de ingreso por teléfono → OTP (mobile-first)
- [ ] Password como método secundario opcional
- [ ] Auth context/hook global; rutas protegidas

**Testing**
- [ ] Unit del flujo OTP (90%); integración de endpoints; e2e de alta por teléfono

### 1.2 Categorías y Navegación

**Backend**
- [ ] `GET /categories` (árbol), `/{slug}`, `/{id}/children`
- [ ] Jerarquía parent-child, slugs SEO, caching Redis (1h TTL)

**Frontend**
- [ ] Sidebar colapsable (desktop) / drawer (mobile)
- [ ] Breadcrumbs; iconos por categoría

### 1.3 Publicación de Avisos ⭐

**Backend**
- [ ] CRUD completo de `listings` (soft delete)
- [ ] Precio **USD/ARS** con `price_usd_ref` y `fx_rate_at_publish`
- [ ] Campo `department` (departamentos de San Juan)
- [ ] Upload múltiple de imágenes a S3/MinIO + optimización webp
- [ ] Slugs únicos SEO; contador de views; expiración 90 días
- [ ] `search_vector` (tsvector español) mantenido por trigger

**Frontend**
- [ ] Grid con lazy loading + skeletons
- [ ] Detalle de aviso (galería con zoom)
- [ ] Formulario de publicación multi-paso (wizard) con preview de imágenes
- [ ] Selector de moneda USD/ARS y de departamento
- [ ] Editar/eliminar con confirmación

### 1.4 Búsqueda y Filtros

**Backend**
- [ ] `GET /search` full-text (PostgreSQL, español, índice GIN)
- [ ] Filtros: categoría, precio, **departamento**, condición, moneda
- [ ] Orden: relevancia, precio, fecha; paginación cursor-based
- [ ] `GET /search/suggestions` (autocomplete)

**Frontend**
- [ ] Search bar sticky en header + sugerencias (debounce 300ms)
- [ ] Filtros: sidebar (desktop) / drawer (mobile); chips de filtros activos
- [ ] Estados: sin resultados, cargando; infinite scroll

### 1.5 Contacto por WhatsApp ⭐

**Backend**
- [ ] `POST /listings/{id}/contact` — incrementa `contacts_count`, devuelve deep link `wa.me` con mensaje precargado (título + link del aviso)
- [ ] Teléfono del vendedor **resuelto server-side**, nunca en el HTML inicial

**Frontend**
- [ ] Botón verde "Contactar por WhatsApp" como CTA primario del aviso
- [ ] El teléfono aparece solo tras el clic

### 1.6 Perfil de Usuario

**Backend**
- [ ] `GET /users/{id}` (público), `/users/{id}/listings`, `PUT /users/me`, avatar, baja de cuenta (soft delete)

**Frontend**
- [ ] Perfil público; edición de perfil; "Mis avisos"; ajustes; baja de cuenta

### 1.7 SEO (temprano) ⭐

- [ ] URLs con slug (`/autos/toyota-corolla-2018-xxxx`)
- [ ] Meta tags + Open Graph por aviso
- [ ] Datos estructurados Schema.org `Product`/`Offer`
- [ ] `sitemap.xml` dinámico + `robots.txt`
- [ ] SSR/ISR para que Google indexe contenido real

---

## ✅ Criterios de Aceptación MVP

### Funcional
- [ ] Un usuario se registra e ingresa por OTP de WhatsApp
- [ ] Publica un aviso con imágenes y precio en USD o ARS
- [ ] Busca y filtra por categoría, precio y departamento
- [ ] Contacta al vendedor por WhatsApp (y el clic se cuenta)
- [ ] Gestiona sus avisos (editar/eliminar)

### Performance
- [ ] LCP < 2.5s en mobile (Lighthouse)
- [ ] API p95 < 500ms
- [ ] Imágenes < 100KB promedio (webp)

### Diseño
- [ ] Todas las pantallas pasan `impeccable audit` con **0 findings P0/P1**
- [ ] Navegación por teclado completa; focus visible

### SEO
- [ ] Un aviso renderiza con SSR/ISR e incluye Schema.org válido (test con Rich Results)
- [ ] `sitemap.xml` accesible y correcto

### Seguridad/Legal
- [ ] Rate limiting activo; sanitización de inputs; prepared statements
- [ ] Teléfono no expuesto antes del clic
- [ ] Términos y Política de Privacidad según Ley 25.326 y 24.240 publicados

### Testing
- [ ] Unit > 80%; e2e de los 5 flujos críticos; load test 100 concurrentes

---

## 🚪 Definition of Done

MVP desplegado en staging, todos los criterios en verde, y listo para cargar los datos reales de proveedores. Este es el punto de lanzamiento inicial.
