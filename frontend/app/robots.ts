import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/ingresar",
        "/publicar",
        "/mis-avisos",
        "/perfil",
        "/ajustes",
        "/avisos/",
        "/buscar",
        "/uniformes/carrito",
        "/uniformes/pedido/",
        "/uniformes/admin",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
