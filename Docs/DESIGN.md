# DESIGN.md

> Sistema de diseño que Impeccable respeta y hace cumplir. Es la fuente de verdad visual del frontend. Toda pantalla nueva debe sentirse parte del mismo producto.

## Color

Paleta base azul, con verde para CTA y verde propio de WhatsApp para contacto.

| Rol | Token | Light | Notas |
|-----|-------|-------|-------|
| Primary | `--color-primary` | `#2563EB` | Azul principal (acciones, links) |
| Primary hover | `--color-primary-hover` | `#1D4ED8` | Hover de botones primarios (blanco encima 6,7:1, AA). En dark: `#60A5FA` |
| On Primary | `--color-on-primary` | `#FFFFFF` | Texto sobre primary |
| Secondary | `--color-secondary` | `#3B82F6` | Azul de apoyo |
| Accent / CTA | `--color-accent` | `#15803D` | Verde de acción (publicar, confirmar). Ajustado desde `#16A34A` (texto blanco 3.3:1 → 5.0:1, AA) |
| WhatsApp | `--color-whatsapp` | `#25D366` | **Solo** para el botón de contacto por WhatsApp |
| Background | `--color-background` | `#EFF6FF` | Fondo general |
| Foreground | `--color-foreground` | `#1E40AF` | Texto principal |
| Muted | `--color-muted` | `#E9EFF8` | Fondos suaves, superficies |
| Border | `--color-border` | `#BFDBFE` | Bordes, divisores |
| Destructive | `--color-destructive` | `#DC2626` | Eliminar, errores |
| Ring | `--color-ring` | `#2563EB` | Focus visible |

**Dark mode:** obligatorio. Cada token se redefine bajo `prefers-color-scheme: dark` y bajo `[data-theme="dark"]`. `body` con background explícito en ambos modos. Contraste AA en los dos.

**Reglas de color**
- El verde WhatsApp es exclusivo del contacto. No usarlo para otra cosa.
- El color nunca es el único indicador de estado (acompañar con texto/icono).
- Nada de "beige de IA" ni degradados decorativos sin propósito.

## Type

- **Headings:** Rubik (Google Fonts), pesos 400–700.
- **Body:** Nunito Sans (Google Fonts), pesos 300–700.

Escala (mobile-first, ajustar hacia arriba en desktop):
- Display / hero: 32px+ / Rubik 600–700
- H1: 28px / Rubik 600
- H2: 22px / Rubik 600
- H3: 18px / Rubik 500
- Body: 16px / Nunito Sans 400
- Meta / secundario: 13px / Nunito Sans 400

**Reglas de tipografía**
- Sin serif itálica decorativa (patrón típico de slop).
- Líneas de lectura cómodas; no texto de ancho completo en desktop.
- Jerarquía sin saltar niveles (no h1→h3).

## Shape

- **Radios:** 8px campos/inputs · 12px cards · pill (999px) para chips y el botón de WhatsApp.
- **Borders:** 1px `--color-border`. Sin el patrón "borde finito + sombra ancha".
- **Sombras:** sutiles y consistentes; una sola escala. Elevación real, no decorativa.
- **Espaciado:** escala de 4px (4/8/12/16/24/32/48). Secciones amplias (gaps 48px+) en landing.

## Layout

- **Mobile (<640px):** 1 columna, bottom nav, menú hamburguesa, gutter lateral 16px, sin scroll horizontal.
- **Tablet (640–1024px):** 2 columnas, filtros en sidebar.
- **Desktop (>1024px):** 3–4 columnas, sidebar persistente.
- Search bar sticky en el header. Filtros en drawer (mobile) / sidebar (desktop).

## Components

Base sobre shadcn/ui, tematizados con los tokens de arriba.
- **Button:** primary (azul), accent (verde CTA), whatsapp (verde WhatsApp), ghost, destructive.
- **Card:** aviso (foto + precio + título + departamento + botón WhatsApp). Sin tarjetas anidadas en tarjetas.
- **Input / Select:** siempre con label visible (no solo placeholder).
- **Chip:** filtros activos, categorías (scroll-snap horizontal en mobile).
- **Dialog / Drawer:** confirmaciones y filtros.
- **Badge:** destacado, verificado, condición (nuevo/usado).
- **Skeleton:** en grids y detalle mientras carga.

## Motion

- Transiciones 150–300ms, ease-out. Hover con cambio de color; press sutil.
- Respetar `prefers-reduced-motion`.
- Sin puntitos pulsantes de "AI thinking" ni animaciones sin función.

## Anti-slop (lo que Impeccable debe rechazar)

- Beige de IA / degradados decorativos.
- Serif itálica de adorno en titulares.
- Borde finito con sombra ancha.
- Tarjetas dentro de tarjetas dentro de tarjetas.
- CTAs genéricos ("Get started", "Continue") — usar verbos concretos ("Publicar aviso", "Contactar por WhatsApp").
- Labels solo en placeholder, sin `<label>`.
- Estados que se ven todos iguales (activo vs pendiente deben distinguirse).

## Job por pantalla

- **Landing / búsqueda:** persuadir y encontrar → search bar como protagonista.
- **Detalle de aviso:** decidir y contactar → fotos, precio y botón WhatsApp mandan.
- **Publicar:** operar rápido → wizard de una acción por paso.
- **Mis avisos / perfil:** operar → claridad y control, sin ruido.
