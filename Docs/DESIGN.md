---
name: CompraVendeAqui
description: Clasificados y marketplace de San Juan, con la paleta de Ischigualasto.
colors:
  primary: "#a3391e"
  primary-hover: "#842c15"
  on-primary: "#ffffff"
  secondary: "#1f4f8a"
  on-secondary: "#ffffff"
  accent: "#e2a33b"
  on-accent: "#2a1606"
  whatsapp: "#25d366"
  on-whatsapp: "#052e16"
  background: "#f3f1ee"
  foreground: "#2a211c"
  muted: "#eae5df"
  muted-foreground: "#6b5d53"
  card: "#ffffff"
  card-foreground: "#2a211c"
  border: "#e0d8cf"
  destructive: "#b42318"
  on-destructive: "#ffffff"
  success: "#3d6b22"
  ring: "#a3391e"
  header: "#16233f"
  on-header: "#f3f1ee"
  header-muted: "#b8c3d9"
  scrim: "rgb(14 22 42)"
typography:
  display:
    fontFamily: "Rubik, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.1
  h1:
    fontFamily: "Rubik, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: "2.1rem"
  h2:
    fontFamily: "Rubik, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: "1.85rem"
  h3:
    fontFamily: "Rubik, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: "1.6rem"
  body:
    fontFamily: "Nunito Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: "1.5rem"
  meta:
    fontFamily: "Nunito Sans, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: "1.15rem"
rounded:
  input: "8px"
  card: "12px"
  pill: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
  "12": "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.input}"
    padding: "8px 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-accent:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.input}"
    padding: "8px 20px"
    height: "44px"
  button-whatsapp:
    backgroundColor: "{colors.whatsapp}"
    textColor: "{colors.on-whatsapp}"
    rounded: "{rounded.pill}"
    height: "44px"
  header-band:
    backgroundColor: "{colors.header}"
    textColor: "{colors.on-header}"
  search-input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.input}"
    height: "44px"
  listing-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.card}"
    padding: "16px"
  category-chip-icon:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.primary}"
    rounded: "{rounded.pill}"
    size: "48px"
---

# DESIGN.md

> Sistema de diseño que Impeccable respeta y hace cumplir. Es la fuente de verdad visual del frontend, escrita a partir del código que está en producción (`frontend/app/globals.css`, `frontend/tailwind.config.ts`). Toda pantalla nueva tiene que sentirse parte del mismo producto. El frontmatter es normativo; la prosa explica dónde y por qué.

**Norte creativo: "Ischigualasto de día, cielo de noche".** Un marketplace grande que el visitante sabe usar sin aprender nada, vestido con el paisaje de San Juan: franja de cielo nocturno arriba, barranca roja para actuar, ocre para publicar, arcilla gris de fondo y tarjetas blancas donde la foto del producto manda.

## Color

Paleta del Valle de la Luna / Ischigualasto. Tokens en `:root` de `globals.css`, expuestos en Tailwind como `primary`, `accent`, `header`, etc.

| Rol | Token | Light | Dark | Notas |
|-----|-------|-------|------|-------|
| Primary | `--color-primary` | `#A3391E` | `#E8825F` | **Rojo arenisca.** Acciones, links, botón Buscar, íconos de rubro, banda de cierre "¿Tenés algo para vender?". Blanco encima 6,6:1 (AA) |
| Primary hover | `--color-primary-hover` | `#842C15` | `#F09A7B` | Hover de botones primarios (blanco encima 8,9:1) |
| On Primary | `--color-on-primary` | `#FFFFFF` | `#1A0A04` | Texto sobre primary |
| Secondary | `--color-secondary` | `#1F4F8A` | `#8DB3E8` | Azul cielo de altura. Hoy solo como hover de links de texto en login/perfil |
| Accent | `--color-accent` | `#E2A33B` | `#E8B04F` | **Ocre.** "Publicar aviso" y confirmaciones (ver regla abajo) |
| On Accent | `--color-on-accent` | `#2A1606` | `#241505` | Texto oscuro sobre ocre (7,8:1). Nunca blanco sobre ocre |
| WhatsApp | `--color-whatsapp` | `#25D366` | `#25D366` | **Solo** el botón de contacto por WhatsApp |
| On WhatsApp | `--color-on-whatsapp` | `#052E16` | `#052E16` | Texto oscuro sobre el verde |
| Background | `--color-background` | `#F3F1EE` | `#0D1424` | **Gris arcilla** de la Cancha de Bochas (light); noche del parque (dark) |
| Foreground | `--color-foreground` | `#2A211C` | `#EDE7E0` | **Umber.** Texto principal y precios (14:1 sobre el fondo) |
| Muted | `--color-muted` | `#EAE5DF` | `#1C2842` | Superficies suaves, fondo de íconos de rubro, hover de ítems de menú |
| Muted fg | `--color-muted-foreground` | `#6B5D53` | `#A9B4C9` | Meta, placeholders, departamento (5,6:1 sobre el fondo) |
| Card | `--color-card` | `#FFFFFF` | `#151F35` | Tarjetas, buscador, menús desplegables |
| Border | `--color-border` | `#E0D8CF` | `#2A3754` | Bordes y divisores (aplicado a `*` por defecto) |
| Destructive | `--color-destructive` | `#B42318` | `#F87171` | Eliminar, errores |
| Success | `--color-success` | `#3D6B22` | `#9CCC72` | Texto de estado positivo (pagado, guardado). Verde jarilla; nunca ocre como texto sobre claro |
| Ring | `--color-ring` | `#A3391E` | `#E8825F` | Focus visible (se redefine dentro del header, ver abajo) |
| Header | `--color-header` | `#16233F` | `#0A1020` | **Azul noche.** Franja del header, fondo del carrusel y de la tarjeta de tiendas |
| On Header | `--color-on-header` | `#F3F1EE` | `#EDE7E0` | Texto sobre la franja (13,8:1) |
| Header muted | `--color-header-muted` | `#B8C3D9` | `#9AA8C2` | Accesos secundarios del header (8,8:1) |

`theme-color` del navegador = color del header (`#16233F` light / `#0A1020` dark), así la barra del celular continúa la franja.

**Dark mode:** obligatorio. Cada token se redefine dos veces, idénticas: bajo `@media (prefers-color-scheme: dark)` con `:root:not([data-theme="light"])`, y bajo `:root[data-theme="dark"]`. Las sombras también tienen versión dark. `body` lleva background y color explícitos en ambos modos. Contraste AA en los dos.

**Superficies del navegador:** `accent-color` y `caret-color` = primary; `::selection` en primary con texto on-primary; `scrollbar-color` border sobre background. La flecha de los `<select>` nativos (`.select-chevron`) usa el muted-foreground light (`#6B5D53`).

**Reglas de color**
- **La regla del verde WhatsApp.** El verde `#25D366` es exclusivo del contacto por WhatsApp. Nada más en el sitio es verde.
- **La regla del ocre que publica.** El ocre como *acción* es solo "Publicar aviso" (y sus variantes, como "Publicar el primero") y confirmaciones. Cualquier otra acción va en rojo arenisca: en el carrusel, la diapositiva que lleva a `/publicar` usa ocre y las demás usan primary. Fuera de botones, el ocre aparece únicamente como marca sobre azul noche: el "Aqui" del logo y el indicador activo del carrusel. Ocre como texto sobre fondo claro no pasa contraste (2,2:1 sobre blanco): prohibido.
- **La regla de una sola franja.** El azul noche es la franja del header y los paneles con foto (carrusel, tarjeta de tienda). No es color de botón ni de texto sobre fondos claros.
- El color nunca es el único indicador de estado (acompañar con texto/icono).
- **Opacidad sobre tokens: no anda.** Los colores son `var(--color-*)` con valor hex, así que los modificadores de opacidad de Tailwind (`bg-primary/90`, `bg-header/60`) **no generan color** y fallan en silencio. Para velos y scrims usar valores `rgb()` explícitos en arbitrary values: `from-[rgb(14_22_42/0.9)]`, `bg-[rgb(14_22_42/0.55)]`, `bg-[rgb(243_241_238/0.6)]`. Los colores literales de Tailwind (`white/10`, `white/15`) sí funcionan y se usan para hover dentro de la franja.

## Type

- **Headings:** Rubik (variable 300–900), en `h1–h4` y la clase `font-heading`.
- **Body:** Nunito Sans (variable 200–1000), por defecto en `body`.
- Ambas se sirven desde el propio sitio (`@fontsource-variable`, solo latin, `display: swap`), no desde Google Fonts: el build no depende de terceros y el visitante no les pasa datos.

Escala (tokens `text-*` de Tailwind, mobile-first):
- **Display del carrusel:** Rubik 700, 28px en mobile → 36px (`2.25rem`, interlineado 1.1) desde `sm`, con `text-balance`.
- **h1** (`text-h1`): 28px / Rubik 600–700. Banda de cierre "¿Tenés algo para vender?".
- **h2** (`text-h2`): 22px / Rubik 600. Títulos de filas y secciones de portada.
- **h3** (`text-h3`): 18px / Rubik 600. Precio en la tarjeta de aviso, logo, botones `lg`.
- **Body** (`text-base`): 16px / Nunito Sans 400.
- **Meta** (`text-meta`): 13px / Nunito Sans 400–600. Departamento, "Ver todos", nombres de rubro, accesos del header.
- **Crédito de foto:** 11px (`0.6875rem`), única excepción por debajo de meta.

**Reglas de tipografía**
- Sin serif itálica decorativa.
- `p` con `text-wrap: pretty` (sin palabra suelta al final). Textos largos con `max-w-prose`.
- Jerarquía sin saltar niveles. La portada tiene un `h1` solo para lectores (`sr-only`); cada fila y sección es un `h2`.
- El precio va en Rubik 600 color foreground, no en rojo.

## Shape

- **Radios:** 8px (`rounded-input`) campos, botones, menús, buscador · 12px (`rounded-card`) tarjetas, carrusel, panel de rubros, tarjeta de tienda, banda de cierre · pill (`rounded-pill`) chips, íconos de rubro, flechas, puntos del carrusel, badges y botón de WhatsApp.
- **Borders:** 1px `--color-border` en tarjetas y paneles. Hover de tarjeta de aviso = borde en primary (no levanta sombra).
- **Sombras:** una sola escala, umber tenue en light y negra en dark:
  - `shadow-sm` `0 1px 2px 0 rgb(42 33 28 / .06)`: tarjeta de aviso en reposo.
  - `shadow` `0 2px 8px -1px rgb(42 33 28 / .09)`: flechas del carrusel, tarjeta de tienda en reposo.
  - `shadow-md` `0 6px 16px -2px rgb(42 33 28 / .13)`: header sticky, carrusel, panel de rubros montado, menús desplegables, flechas de fila.
- **Espaciado:** escala de 4px (4/8/12/16/24/32/48). Portada con `gap-10` (40px) mobile / `gap-12` (48px) desktop entre bloques; 12px entre título de sección y contenido.

## Layout

- **Contenedor:** `max-w-6xl` (1152px) centrado, gutter 16px, `py-6`. El header es full-bleed con su contenido en el mismo `max-w-6xl`.
- **Mobile (<640px):** 1 columna, bottom nav (la cuenta vive ahí), buscador en su propia fila bajo el logo, sin scroll horizontal de página (las filas scrollean dentro de sí con bleed `-mx-4 px-4`).
- **Tablet (640–1024px):** grids de 2 columnas, panel de rubros en 4 columnas.
- **Desktop (≥1024px):** filas de 5 tarjetas visibles, panel de rubros en 8 columnas, segunda fila de accesos en el header.
- Search bar sticky en el header en todas las pantallas. Filtros en drawer (mobile) / sidebar (desktop).

**Composición de la portada (en orden):**
1. Carrusel principal con fotos del valle.
2. Panel de rubros (8 primeras categorías) montado sobre el borde inferior del carrusel (`-mt-6` / `-mt-8`, `z-10`).
3. Filas de avisos por rubro (Electrodomésticos, TV audio y video, Tecnología, Para tu casa, Herramientas y construcción, Deportes y aire libre). Un aviso aparece en una sola fila; una fila con menos de 4 avisos no se muestra.
4. Tiendas.
5. Publicados recientemente (grid de 2 columnas, hasta 8, sin repetir los de las filas), con estado vacío que invita a publicar.
6. Banda de cierre en primary con "Publicar aviso" en ocre.
Cada bloque se oculta si su dato no carga.

## Components

Base sobre shadcn/ui, tematizados con los tokens de arriba.

- **Button** (`components/ui/button.tsx`): `primary` (rojo arenisca, hover primary-hover), `accent` (ocre con texto oscuro, hover `brightness-95`; solo publicar/confirmar), `whatsapp` (pill, verde), `ghost`, `outline`, `destructive`. Tamaños: default 44px (touch target), `sm` 36px con texto meta, `lg` 48px con texto h3. Focus: anillo 2px en ring con offset 2px sobre el background.
- **Header (franja azul noche):** sticky, `bg-header`, `shadow-md`. Fila 1: logo (Rubik bold, "Aqui" en ocre), buscador blanco que ocupa el ancho libre, cuenta (desktop) y "Publicar aviso" en ocre `sm`. Fila 2 (solo desktop): accesos directos en header-muted, 13px, hover `bg-white/10` y texto on-header.
  - **La regla del foco claro en la franja.** Dentro del header se redefine `--color-ring` a on-header, así el anillo de foco se ve sobre el azul. Los desplegables (sugerencias del buscador, menú de cuenta) son superficies claras y vuelven a `--color-ring: var(--color-primary)`. Todo componente nuevo dentro del header que abra una superficie clara tiene que hacer lo mismo.
  - Elementos de texto dentro de la franja (Ingresar, nombre del usuario) usan on-header y hover `bg-white/10`, nunca el ghost por defecto (que pondría texto umber sobre azul).
- **Search bar:** input blanco 44px, radio 8px, borde transparente, lupa muted a la izquierda, botón "Buscar" primary embebido a la derecha (36px). Combobox ARIA con sugerencias en tarjeta blanca, ítem activo en muted.
- **Menú de cuenta:** `<details>` en el header; panel blanco 208px, radio 8px, borde, `shadow-md`, ítems 16px con hover muted.
- **Carrusel principal** (`components/home/home-carousel.tsx`): tarjeta 12px sobre fondo header, `shadow-md`. Proporción 4:3 mobile, 2:1 `sm`, 16:5 `lg`. Foto `object-cover` con encuadre por diapositiva (`object-position`) y zoom lento 1.05 → 1 en 7s. Velo en degradado de abajo hacia arriba en mobile y de izquierda a derecha en desktop, con `rgb(14 22 42 / .92 → .4 → 0)`. Texto a la izquierda (mitad del ancho en desktop): titular display, texto (oculto bajo 480px), un CTA `lg`. Controles: pausa/reanudar + puntos (activo 24px en ocre, inactivos 6px en `rgb(243 241 238 / .6)`), áreas de toque de 32px; flechas blancas pill 44px solo desde `md`. Avanza cada 7s, se pausa con hover, foco o el botón de pausa (WCAG 2.2.2), y no avanza solo con `prefers-reduced-motion`. Diapositivas ocultas con `aria-hidden` + `inert`. Crédito de la foto arriba a la derecha (ver Anti-slop / imágenes).
- **Panel de rubros:** tarjeta blanca 12px, borde, `shadow-md`, montada sobre el carrusel. Cada rubro = círculo muted 48px con ícono primary 24px + nombre en meta semibold; hover invierte el círculo a primary con ícono blanco. En mobile es una tira con scroll-snap horizontal (ítems de 96px, sin scrollbar visible); desde `sm`, grilla.
- **Fila de avisos** (`components/home/listing-row.tsx`): `h2` + "Ver todos" (meta semibold primary, subrayado en hover) en la misma línea base. Lista horizontal con scroll-snap: 44% del ancho en mobile, 31% desde 480px, 23% `md`, 5 por vista `lg`. En desktop, flechas pill blancas 44px con borde y `shadow-md`, montadas medio afuera del borde (`-left-5` / `-right-5`) a 30% de la altura; cada flecha desaparece al llegar a su punta. Avanza 90% del ancho visible por clic.
- **Tarjeta de aviso** (`components/listings/listing-card.tsx`): blanca, radio 12px, borde, `shadow-sm`; hover borde primary. Foto 4:3 **entera y centrada** (`object-contain` sobre blanco con 8px de aire), porque muchas fotos de producto no son 4:3; sin foto, ícono en muted. Debajo: precio (h3 Rubik), título a 2 líneas, departamento con pin y badge de condición. Toda la tarjeta es el link. Sin botón de WhatsApp en la tarjeta: el contacto vive en el detalle. Sin tarjetas dentro de tarjetas.
- **Tarjeta de tienda:** panel 12px sobre fondo header con foto del valle de fondo, velo `rgb(14 22 42 / .9 → .6 → .15)` de izquierda a derecha, círculo primary 48px con ícono, nombre h2 y descripción en on-header, botón blanco "Entrar a la tienda". Hover: sombra a `shadow-md` y zoom 1.02 de la foto.
- **Banda de cierre:** bloque primary 12px con h1 bold, texto on-primary y "Publicar aviso" en ocre `lg`.
- **Input / Select:** 44px, radio 8px, borde, fondo card; siempre con `<label>` visible (componente `Field`).
- **Badge:** pill, borde, meta semibold (condición, estado, verificado).
- **Chip / Dialog / Drawer / Skeleton:** chips de filtro pill con scroll-snap en mobile; confirmaciones y filtros en dialog/drawer; skeleton en grids y detalle mientras carga.

## Motion

- Transiciones de color 150–300ms (`duration-200` por defecto), curva `ease-out-soft` `cubic-bezier(0.16, 1, 0.3, 1)` en botones.
- Carrusel: fundido entre diapositivas 700ms ease-out, zoom de foto 7s, puntos 300ms.
- Tarjeta de tienda: zoom de foto 500ms ease-out en hover.
- Filas: `scroll-behavior: smooth`.
- `prefers-reduced-motion`: reglas globales llevan animaciones y transiciones a 0.01ms, y el carrusel deja de avanzar solo.
- Sin puntitos pulsantes ni animaciones sin función.

## Anti-slop (lo que Impeccable debe rechazar)

- Beige de IA y degradados decorativos. Los únicos degradados del sistema son velos de legibilidad sobre fotos, en azul noche.
- Hero genérico de "frase + buscador": el buscador vive en el header; la portada abre con el carrusel.
- Serif itálica de adorno en titulares.
- Borde finito con sombra ancha.
- Tarjetas dentro de tarjetas dentro de tarjetas.
- CTAs genéricos ("Get started", "Continue"): verbos concretos ("Publicar aviso", "Contactar por WhatsApp", "Entrar a la tienda", "Elegir colegio").
- Labels solo en placeholder, sin `<label>`.
- Estados que se ven todos iguales.
- Modificadores de opacidad (`/90`) sobre colores del sistema: no generan nada (ver Color).
- Copiar marca, nombre o el amarillo de Mercado Libre: el canon marketplace se toma por estructura, no por identidad.
- **Imágenes con crédito.** Toda foto de terceros con licencia CC BY-SA (las del valle vienen de Wikimedia Commons) muestra su crédito visible donde se usa: "Foto: autor · licencia" con link a la fuente (`rel="noopener noreferrer license"`), y el archivo lleva su procedencia al lado (`public/home/*.webp.json`). Sin crédito, la foto no se publica.

## Job por pantalla

- **Portada:** encontrar y publicar con hábitos de marketplace ya conocidos → carrusel, rubros a un toque, filas de avisos reales; publicar desde el header.
- **Búsqueda / rubro:** encontrar → search bar sticky y filtros.
- **Detalle de aviso:** decidir y contactar → fotos, precio y botón WhatsApp mandan.
- **Publicar:** operar rápido → wizard de una acción por paso.
- **Mis avisos / perfil:** operar → claridad y control, sin ruido.
