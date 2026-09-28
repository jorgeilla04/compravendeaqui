# PRODUCT.md

> Contexto de producto que Impeccable lee antes de cualquier trabajo de diseño. Define para quién y para qué se diseña.

## Product

CompraVendeAqui — plataforma de clasificados y marketplace local para San Juan, Argentina. Reemplazo moderno de compraensanjuan.com.

## Platform

Web (Next.js), mobile-first. Instalable como PWA. Sin app nativa por ahora.

## Users

Compradores y vendedores de San Juan. Perfil:
- **Mayoría en el celular.** 70%+ del tráfico es móvil, muchas veces con datos limitados y equipos de gama media.
- **Vendedores:** particulares que venden usados y comercios/proveedores locales (varios ya comprometidos por rubro). Publican rápido, desde el teléfono, con fotos sacadas en el momento.
- **Compradores:** buscan por rubro o por búsqueda directa, comparan precio y contactan al toque.
- **El contacto real ocurre por WhatsApp**, no por inbox interno ni email. El botón de WhatsApp es la conversión.
- No validan email; sí tienen y usan WhatsApp. Por eso el alta es por teléfono (OTP).
- Precios en **ARS y también en USD** (contexto inflacionario); ambos conviven.

## Purpose

Que un vendedor publique un aviso en menos de 3 minutos desde el celular, y que un comprador lo encuentre y lo contacte por WhatsApp sin fricción.

Métrica central: **clics a WhatsApp por aviso** (conversión real), no page views.

## Principles

- **Mobile-first, siempre.** Si no funciona con una mano en un celular de gama media, no está listo.
- **WhatsApp-first.** El CTA de contacto es lo más visible del aviso.
- **Una acción por pantalla.** No competir dos CTAs por la atención.
- **Rápido y liviano.** Imágenes optimizadas, LCP < 2.5s. Los datos del usuario cuestan.
- **Calmo por defecto.** Sin ruido visual; la información importante primero (precio, fotos, contacto).
- **Precio claro.** Moneda (ARS/USD) siempre visible y sin ambigüedad.
- **Confianza local.** Departamento de San Juan visible; reportar avisos es fácil.

## Accessibility & Inclusion

- WCAG 2.1 AA en modo claro y oscuro.
- Legible en pantallas chicas y con zoom hasta 200%.
- Navegable por teclado; alt text en imágenes; contraste real.
- Español rioplatense como idioma por defecto.

## Legal

Marco argentino: Ley 25.326 (Protección de Datos Personales, AAIP) y Ley 24.240 (Defensa del Consumidor). No GDPR. El teléfono del vendedor no se expone hasta el clic de contacto.
