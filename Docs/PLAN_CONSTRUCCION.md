# 🗺️ Plan de Construcción — CompraVendeAqui (San Juan)

> **Documento índice.** El plan está dividido en un documento por fase. Este archivo explica la estrategia general, el método de diseño del frontend y cómo leer los criterios de aceptación.

> ⚙️ **Entorno de desarrollo nativo (sin Docker) en todas las fases.** Backend
> (`uvicorn`) y frontend (`next dev`) corren directo contra Postgres y Redis
> instalados en la máquina. Docker queda solo como opción de despliegue.

## 📂 Documentos del plan

| Fase | Archivo | Objetivo |
|------|---------|----------|
| 0 | `FASE_0_SETUP.md` | Fundaciones: repo, entornos, CI, design system |
| 1 | `FASE_1_MVP.md` | MVP funcional: OTP, avisos, búsqueda, WhatsApp |
| 2 | `FASE_2_GROWTH.md` | Engagement: favoritos, notificaciones, moderación |
| 3 | `FASE_3_SCALE.md` | Monetización, tiendas, reviews, performance |
| 4 | `FASE_4_POLISH.md` | PWA, seguridad, i18n, analytics, auditoría |

---

## 🎯 Estrategia General

**Filosofía:** MVP iterativo. Construir valor incrementalmente, lanzar rápido con datos reales (proveedores ya comprometidos), iterar con métricas.

```
Fase 0 → Fase 1 (MVP) → Fase 2 (Growth) → Fase 3 (Scale) → Fase 4 (Polish)
 Setup      Core            Engagement        Monetizar        Pulir
```

### Principios

1. **Mobile-First** — 70%+ del tráfico es móvil.
2. **WhatsApp-First** — el contacto real ocurre por WhatsApp, no por inbox interno.
3. **Performance budget** — cada feature mantiene LCP < 2.5s.
4. **Accesibilidad desde el día 1** — WCAG 2.1 AA.
5. **Legal argentino** — Ley 25.326 y 24.240, no GDPR.
6. **Sin sobre-ingeniería** — un VPS + Docker Compose. Escala avanzada solo cuando las métricas la pidan.
7. **Data-driven** — decisiones por métricas (clics a WhatsApp = conversión real).

---

## 🎨 Método de Diseño del Frontend — Impeccable

El frontend se construye y se controla con **Impeccable** (`impeccable.style`).

**Qué es:** un skill para agentes de IA que (a) detecta "AI slop" — los 61 patrones genéricos que los agentes repiten por defecto (bordes finos con sombra ancha, beige de IA, serif itálica decorativa, tarjetas anidadas, puntito pulsante, etc.) — y (b) diseña respetando *nuestro* sistema, guardado en `DESIGN.md` y `PRODUCT.md`.

**Qué NO es:** no aporta paleta ni tipografía. Nuestro look sigue siendo el del `REQUERIMIENTOS.md` (azules, verde CTA, verde WhatsApp, Rubik + Nunito Sans). Eso se vuelca en `DESIGN.md` y Impeccable lo hace respetar.

### Integración operativa (va en Fase 0)

1. Instalar en el repo frontend: `npx impeccable install`
2. `/impeccable init` — genera `PRODUCT.md` (quiénes son los usuarios: compradores/vendedores de San Juan, mayoría en el celular) y `DESIGN.md` (nuestros tokens).
3. `/impeccable hooks on` — activa el hook que revisa cada edición de UI y devuelve findings al agente para que los corrija antes de commitear.
4. Comandos de uso diario: `/impeccable polish`, `distill`, `typeset`, `audit`, `critique`.

### Criterio de calidad de diseño (aplica a TODAS las fases)

> **DoD de diseño:** ninguna pantalla se da por terminada con findings P0 o P1 del detector de Impeccable abiertos. El `audit` corre en CI sobre las UIs tocadas en cada PR.

---

## 🔗 Secuencia de fases

El plan es secuencial: cada fase depende del cierre de la anterior. **No se manejan tiempos ni estimaciones de desarrollo** — solo el orden y los criterios de cierre.

```
Fase 0 ──▶ Fase 1 ──▶ Fase 2 ──▶ Fase 3 ──▶ Fase 4
Setup      MVP         Growth      Scale       Polish
```

Una fase se cierra cuando **todos** sus criterios de aceptación están en verde (ver cada documento). Recién ahí arranca la siguiente.

---

## 📊 Cómo leer los criterios de aceptación

Cada fase lista criterios en formato verificable, agrupados en:
- **Funcional** — qué puede hacer el usuario (testeable de punta a punta).
- **Performance** — números duros (Lighthouse, p95).
- **Diseño** — 0 findings P0/P1 de Impeccable.
- **Seguridad/Legal** — checklist OWASP + marco AR.
- **Testing** — cobertura y e2e de flujos críticos.

Una fase se cierra solo cuando **todos** sus criterios pasan.

---

## ⚠️ Riesgos y Mitigaciones (actualizado)

> Cold start **removido**: resuelto con proveedores reales ya comprometidos por todos los rubros.

### Técnicos

| Riesgo | Prob. | Impacto | Mitigación |
|--------|-------|---------|------------|
| Costos de storage de imágenes | Alta | Medio | Optimización agresiva (webp), CDN, lazy loading |
| Cuellos de botella en DB | Media | Alto | Índices, full-text GIN, `EXPLAIN ANALYZE`; pooling si hace falta |
| Vulnerabilidades de seguridad | Media | Crítico | OWASP, audit, rate limiting |
| Scraping de teléfonos | Media | Alto | Teléfono resuelto server-side solo al clic |
| Deuda de diseño ("AI slop") | Alta | Medio | Impeccable con hooks + audit en CI |

### De proyecto

| Riesgo | Prob. | Impacto | Mitigación |
|--------|-------|---------|------------|
| Scope creep | Alta | Medio | MVP estricto, backlog priorizado |
| Adopción de vendedores | Baja | Crítico | Proveedores ya comprometidos (mitigado) |

---

## 🎯 Próximos pasos

1. Aprobar este plan y los 5 documentos de fase.
2. Ejecutar `FASE_0_SETUP.md`.

---

**Última actualización:** 2026-09-24 · **Versión:** 2.0
