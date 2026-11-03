import type { MetadataRoute } from "next";

import { serverGet } from "@/lib/api";
import { SITE_URL } from "@/lib/constants";

export const revalidate = 3600;

interface Entry {
  path: string;
  updated_at: string | null;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries =
    (await serverGet<Entry[]>("/seo/sitemap", undefined, 3600).catch(
      () => null,
    )) ?? [];
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/terminos`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${SITE_URL}/privacidad`, changeFrequency: "yearly", priority: 0.1 },
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
