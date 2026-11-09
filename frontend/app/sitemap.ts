import type { MetadataRoute } from "next";

import { serverGet } from "@/lib/api";
import { SITE_URL } from "@/lib/constants";
import type { Catalogo } from "@/lib/uniformes/types";

export const revalidate = 3600;

interface Entry {
  path: string;
  updated_at: string | null;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [entries, uniformes] = await Promise.all([
    serverGet<Entry[]>("/seo/sitemap", undefined, 3600)
      .catch(() => null)
      .then((e) => e ?? []),
    serverGet<Catalogo>("/uniformes/catalogo", undefined, 3600).catch(
      () => null,
    ),
  ]);
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/terminos`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${SITE_URL}/privacidad`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${SITE_URL}/uniformes`, changeFrequency: "weekly", priority: 0.8 },
    ...(uniformes?.colegios ?? []).map((c) => ({
      url: `${SITE_URL}/uniformes/${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
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
