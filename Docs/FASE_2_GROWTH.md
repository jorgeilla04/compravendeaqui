# 📈 FASE 2 — Growth Features

> Mejorar engagement y retención sobre el MVP ya lanzado: favoritos, notificaciones, moderación, búsqueda geográfica y mejoras de UX.

**Depende de:** Fase 1

---

## 🎯 Objetivos

- Aumentar retención y valor percibido.
- Dar herramientas de moderación antes de que el volumen las exija.

---

## 📦 Módulos

### 2.1 Favoritos
**Backend**
- [ ] `POST/DELETE /listings/{id}/favorite`, `GET /users/me/favorites`

**Frontend**
- [ ] Botón corazón en cards; página de favoritos; estado optimista

### 2.2 Notificaciones
- [ ] Tipos: nuevo mensaje, interés en tu aviso, aviso por expirar, respuesta a reporte
- [ ] In-app (bell + dropdown); email opcional; preferencias de notificación
- [ ] Marcar todo como leído

### 2.3 Reportes y Moderación
**Backend**
- [ ] `POST /reports`; `GET /moderation/reports`; `PUT /moderation/reports/{id}`
- [ ] Auto-flagging por keywords; auto-suspensión con muchos reportes
- [ ] Toda acción registrada en `audit_log`

**Frontend**
- [ ] Botón reportar + formulario con motivos
- [ ] Dashboard de moderación (ruta protegida, rol admin/moderator)

### 2.4 Mejoras de Búsqueda
- [ ] Búsqueda geográfica (`GET /search/nearby`)
- [ ] Filtros avanzados por categoría
- [ ] Búsquedas guardadas
- [ ] Analytics de queries populares

### 2.5 Analytics básico
- [ ] Tracking de page views y views por aviso
- [ ] **Clics a WhatsApp como métrica central de conversión**
- [ ] Plausible o GA4; eventos custom

### 2.6 Mejoras de UX
- [ ] Skeletons en todas las páginas; updates optimistas
- [ ] Pull-to-refresh (mobile); compartir aviso (Web Share API)
- [ ] Toggle dark mode; galería con zoom

---

## ✅ Criterios de Aceptación

### Funcional
- [ ] Usuario guarda y ve favoritos
- [ ] Recibe notificación in-app ante un nuevo contacto
- [ ] Reporta un aviso; el moderador lo resuelve desde el dashboard
- [ ] Busca avisos cercanos por geolocalización

### Diseño
- [ ] Nuevas pantallas pasan `impeccable audit` con **0 findings P0/P1**
- [ ] Dark mode sin problemas de contraste (WCAG AA en ambos modos)

### Datos
- [ ] Dashboard interno muestra clics a WhatsApp por aviso

### Seguridad
- [ ] Rutas de moderación protegidas por rol; acciones auditadas

### Testing
- [ ] Unit > 80%; e2e de reporte→moderación y de favoritos

---

## 🚪 Definition of Done

Todos los criterios en verde; moderación operativa; métricas de conversión visibles.
