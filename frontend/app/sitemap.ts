import type { MetadataRoute } from "next";

import { serverGet } from "@/lib/api";
import { SITE_URL } from "@/lib/constants";
import type { Tienda, TiendaResumen } from "@/lib/tiendas/types";

export const revalidate = 3600;

interface Entry {
  path: string;
  updated_at: string | null;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [entries, tiendas] = await Promise.all([
    serverGet<Entry[]>("/seo/sitemap", undefined, 3600)
      .catch(() => null)
      .then((e) => e ?? []),
    serverGet<TiendaResumen[]>("/tiendas", undefined, 3600)
      .catch(() => null)
      .then((t) => t ?? []),
  ]);
  const detalles = await Promise.all(
    tiendas.map((t) =>
      serverGet<Tienda>(`/tiendas/${t.slug}`, undefined, 3600).catch(
        () => null,
      ),
    ),
  );
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/terminos`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${SITE_URL}/privacidad`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${SITE_URL}/tiendas`, changeFrequency: "weekly", priority: 0.8 },
    ...detalles.flatMap((tienda) =>
      tienda
        ? [
            {
              url: `${SITE_URL}/tiendas/${tienda.slug}`,
              changeFrequency: "weekly" as const,
              priority: 0.7,
            },
            ...tienda.grupos.map((g) => ({
              url: `${SITE_URL}/tiendas/${tienda.slug}/${g.slug}`,
              changeFrequency: "weekly" as const,
              priority: 0.6,
            })),
          ]
        : [],
    ),
  ];
  return [
    ...staticPages,
    ...entries.map((entry) => {
      const isListing = entry.path.split("/").length > 2;
      return {
        url: `${SITE_URL}${entry.path}`,
        lastModified: entry.updated_at ?? undefined,
        changeFrequency: isListing ? ("daily" as const) : ("hourly" as const),
        priority: isListing ? 0.7 : 0.8,
      };
    }),
  ];
}
