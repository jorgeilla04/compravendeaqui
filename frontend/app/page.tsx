import Link from "next/link";
import { Suspense } from "react";

import { CategoryIcon } from "@/components/listings/category-icon";
import { ListingGrid } from "@/components/listings/listing-grid";
import { SearchBar } from "@/components/layout/search-bar";
import { Button } from "@/components/ui/button";
import { serverGet } from "@/lib/api";
import type { CategoryNode, ListingPage } from "@/lib/types";

export const revalidate = 60;

/**
 * Landing: el job es encontrar (DESIGN.md) → la búsqueda manda, después
 * los rubros y los avisos recientes.
 */
export default async function HomePage() {
  const [categories, recent] = await Promise.all([
    serverGet<CategoryNode[]>("/categories", undefined, 3600).catch(() => null),
    serverGet<ListingPage>("/listings", { limit: 8, sort: "newest" }, 60).catch(
      () => null,
    ),
  ]);

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-5 pt-4 md:pt-10">
        <div className="flex max-w-2xl flex-col gap-3">
          <h1 className="font-heading text-display font-bold leading-tight text-foreground md:text-[2.5rem] md:leading-[1.15]">
            Comprá y vendé en San Juan
          </h1>
          <p className="max-w-prose text-base text-muted-foreground">
            Encontrá lo que buscás cerca tuyo y hablá con el vendedor por
            WhatsApp, sin vueltas.
          </p>
        </div>
        <Suspense fallback={<div className="h-11 max-w-2xl" />}>
          <SearchBar className="max-w-2xl" />
        </Suspense>
      </section>

      {categories && categories.length > 0 ? (
        <section aria-labelledby="rubros" className="flex flex-col gap-4">
          <h2 id="rubros" className="font-heading text-h2 font-semibold">
            Buscá por rubro
          </h2>
          <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 md:grid-cols-4 lg:grid-cols-6">
            {categories.map((category) => (
              <li
                key={category.id}
                className="w-32 shrink-0 snap-start sm:w-auto"
              >
                <Link
                  href={`/${category.slug}`}
                  className="flex h-full min-h-24 flex-col items-start justify-between gap-3 rounded-card border border-border bg-card p-3 text-base font-semibold text-foreground transition-colors duration-200 hover:border-primary hover:bg-muted"
                >
                  <CategoryIcon
                    name={category.icon}
                    className="size-6 text-primary"
                  />
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="recientes" className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="recientes" className="font-heading text-h2 font-semibold">
            Publicados recientemente
          </h2>
          <Link
            href="/buscar?sort=newest"
            className="text-meta font-semibold text-primary hover:underline"
          >
            Ver todos
          </Link>
        </div>
        {recent && recent.items.length > 0 ? (
          <ListingGrid items={recent.items} />
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-card border border-dashed border-border bg-card p-6">
            <p className="text-base text-muted-foreground">
              {recent
                ? "Todavía no hay avisos publicados."
                : "No pudimos cargar los avisos. Probá recargar la página."}
            </p>
            <Button asChild variant="accent">
              <Link href="/publicar">Publicar el primero</Link>
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
