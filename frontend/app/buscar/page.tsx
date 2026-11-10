import type { Metadata } from "next";

import { SearchResults } from "@/components/search/search-results";
import { TiendasEncontradas } from "@/components/search/tiendas-encontradas";
import {
  apiQuery,
  cacheSeconds,
  endpointFor,
  parseFilters,
} from "@/components/search/params";
import { FormMessage } from "@/components/ui/form";
import { serverGet } from "@/lib/api";
import type { TiendaEncontrada } from "@/lib/tiendas/types";
import type { CategoryNode, ListingPage } from "@/lib/types";

type Props = { searchParams: Record<string, string | string[] | undefined> };

export function generateMetadata({ searchParams }: Props): Metadata {
  const { q } = parseFilters(searchParams);
  return {
    title: q ? `${q} en San Juan` : "Buscar avisos en San Juan",
    // Las páginas de resultados no se indexan: se indexan avisos y categorías.
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const filters = parseFilters(searchParams);
  const [page, categories, tiendas] = await Promise.all([
    // Caché corta y acotada (ver cacheSeconds): un aviso nuevo aparece enseguida.
    serverGet<ListingPage>(
      endpointFor(filters),
      apiQuery(filters),
      cacheSeconds(filters),
    ).catch(() => null),
    serverGet<CategoryNode[]>("/categories", undefined, 3600).catch(() => []),
    // Uniformes por colegio y otras tiendas: no son avisos, se buscan aparte.
    filters.q
      ? serverGet<TiendaEncontrada[]>(
          "/tiendas/buscar",
          { q: filters.q },
          300,
        ).catch(() => null)
      : null,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-h1 font-semibold">
        {filters.q ? `Resultados para “${filters.q}”` : "Todos los avisos"}
      </h1>
      {tiendas?.length ? <TiendasEncontradas encontradas={tiendas} /> : null}
      {page ? (
        <SearchResults
          basePath="/buscar"
          filters={filters}
          initial={page}
          categories={categories ?? []}
        />
      ) : (
        <FormMessage>
          No pudimos cargar los resultados. Probá de nuevo en unos segundos.
        </FormMessage>
      )}
    </div>
  );
}
