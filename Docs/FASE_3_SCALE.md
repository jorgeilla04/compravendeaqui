# 🚀 FASE 3 — Scale & Monetización

> Monetización (schema ya listo desde Fase 1), tiendas de vendedores, reviews, y optimización de performance cuando las métricas la justifiquen.

**Depende de:** Fase 2

---

## 🎯 Objetivos

- Activar ingresos con destacados y planes.
- Dar identidad a vendedores recurrentes (tiendas).
- Optimizar solo lo que las métricas señalen.

---

## 📦 Módulos

### 3.1 Monetización ⭐
**Backend**
- [ ] `POST /payments/intent` (MercadoPago), `POST /payments/webhook`, `GET /users/me/payments`
- [ ] Productos: `featured`, `bump`, `store_plan`, `verified_badge`
- [ ] Vigencia de destacados (`featured_until`)

**Frontend**
- [ ] Flujo de pago de destacado desde el aviso
- [ ] Badge de vendedor verificado
- [ ] Historial de pagos en el perfil

### 3.2 Sistema de Tiendas
**Backend**
- [ ] `POST /stores`, `GET /stores/{slug}`, `PUT /stores/{id}`, `GET /stores/{id}/listings`

**Frontend**
- [ ] Página de tienda personalizada (logo, banner)
- [ ] Avisos destacados dentro de la tienda
- [ ] Rating de tienda

### 3.3 Reviews y Ratings
**Backend**
- [ ] `POST /reviews`, `GET /users/{id}/reviews`, `PUT /reviews/{id}/reply`

**Frontend**
- [ ] Calificar tras contacto/transacción; reviews con texto y fotos
- [ ] Respuesta del vendedor; rating promedio en perfil

### 3.4 Performance (por métricas, no por defecto)
**Backend**
- [ ] Optimización de queries (`EXPLAIN ANALYZE`)
- [ ] Estrategia de cache Redis (avisos/categorías populares)
- [ ] `pgbouncer` **si** el pooling hace falta
- [ ] Compresión de respuestas

**Frontend**
- [ ] Code splitting por ruta; ISR en páginas de aviso
- [ ] Análisis y reducción de bundle; monitoreo de Web Vitals

**Infra (solo si las métricas lo piden)**
- [ ] Load test 1000 concurrentes
- [ ] Read replicas / particionado — **documentar y activar solo si el load test lo exige**

---

## ✅ Criterios de Aceptación

### Funcional
- [ ] Un vendedor paga un destacado por MercadoPago y su aviso queda destacado hasta `featured_until`
- [ ] El webhook confirma el pago y actualiza estado
- [ ] Un vendedor crea su tienda y aparece con su branding
- [ ] Un comprador deja review; el vendedor responde

### Performance
- [ ] API p95 < 500ms bajo carga de prueba
- [ ] Web Vitals en verde tras optimización

### Diseño
- [ ] Pantallas de pago/tienda/reviews pasan `impeccable audit` con **0 findings P0/P1**

### Seguridad
- [ ] Webhook de pago validado (firma/secret); idempotencia
- [ ] Ownership verificado en tiendas y reviews

### Testing
- [ ] Unit > 80%; e2e del flujo de pago (sandbox MercadoPago)

---

## 🚪 Definition of Done

Ingresos activables, tiendas y reviews operativos, performance validada bajo carga. Escala avanzada solo si el load test la justifica.
