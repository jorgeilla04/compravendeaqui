import type { MetadataRoute } from "next";

/** Para "Agregar a la pantalla de inicio" en el celular. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CompraVendeAqui — Clasificados de San Juan",
    short_name: "CompraVendeAqui",
    description: "Comprá y vendé en San Juan.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f1ee",
    theme_color: "#16233f",
    lang: "es-AR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
