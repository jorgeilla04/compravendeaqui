# 🎨 FASE 4 — Polish & Optimization

> Pulido final: PWA, auditoría de accesibilidad y seguridad, i18n, SEO/marketing avanzado y observabilidad.

**Depende de:** Fase 3

---

## 🎯 Objetivos

- Refinar la experiencia y cerrar deudas.
- Endurecer seguridad y accesibilidad con auditorías formales.

---

## 📦 Módulos

### 4.1 PWA
- [ ] `manifest.json`; Service Worker
- [ ] Offline (cache de avisos vistos); add to home screen
- [ ] Push notifications; background sync

### 4.2 Auditoría de Accesibilidad
- [ ] Audit con axe-core; testing con screen readers (NVDA, VoiceOver)
- [ ] Navegación por teclado; verificación de contraste
- [ ] Corregir todos los issues críticos

### 4.3 Endurecimiento de Seguridad
- [ ] Audit OWASP Top 10; pentesting básico
- [ ] Refinar rate limiting; revisar sanitización
- [ ] Scan de vulnerabilidades en dependencias
- [ ] Security headers (CSP, HSTS)

### 4.4 Internacionalización
- [ ] i18n (next-intl); español (default) + inglés
- [ ] Formato de moneda y fecha localizados

### 4.5 Marketing / SEO avanzado
- [ ] Refinar meta tags y Open Graph; imágenes sociales
- [ ] RSS de nuevos avisos
- [ ] Revisión de sitemap y datos estructurados

### 4.6 Analytics y Observabilidad
- [ ] Dashboard de métricas de negocio
- [ ] Sentry (errores); monitoreo de performance
- [ ] Widget de feedback de usuarios
- [ ] Framework de A/B testing (opcional)

---

## ✅ Criterios de Aceptación

### Funcional
- [ ] La app se instala como PWA y funciona offline para avisos ya vistos
- [ ] Push notifications entregadas
- [ ] La interfaz conmuta español/inglés correctamente

### Accesibilidad
- [ ] WCAG 2.1 AA verificado con axe-core y screen readers, sin issues críticos

### Seguridad
- [ ] OWASP Top 10 revisado; headers CSP/HSTS activos; dependencias sin vulnerabilidades críticas

### Diseño
- [ ] Auditoría final: toda la app pasa `impeccable audit` con **0 findings P0/P1**

### Observabilidad
- [ ] Sentry capturando errores; dashboard de negocio en línea

### Testing
- [ ] Suite completa en verde; regresión de flujos críticos

---

## 🚪 Definition of Done

App instalable, accesible, endurecida y observada. Lista para operar y crecer.
