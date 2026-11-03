"use client";

import { SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  ListingGrid,
  ListingGridSkeleton,
} from "@/components/listings/listing-grid";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { api, errorMessage } from "@/lib/api";
import { CONDITIONS, SORTS } from "@/lib/constants";
import type { CategoryNode, ListingCard, ListingPage, Sort } from "@/lib/types";

import { FiltersForm } from "./filters-form";
import {
  apiQuery,
  endpointFor,
  type SearchFilters,
  toQueryString,
} from "./params";

interface Props {
  /** Ruta base de la página: /buscar o /<categoria>. */
  basePath: string;
  filters: SearchFilters;
  initial: ListingPage;
  categories: CategoryNode[];
  lockCategory?: boolean;
}

export function SearchResults({
  basePath,
  filters,
  initial,
  categories,
  lockCategory,
}: Props) {
  const router = useRouter();
  const [items, setItems] = React.useState<ListingCard[]>(initial.items);
  const [cursor, setCursor] = React.useState(initial.next_cursor);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const sentinel = React.useRef<HTMLDivElement>(null);

  // Nueva búsqueda (cambió la URL): se reinicia la lista con los datos del server.
  React.useEffect(() => {
    setItems(initial.items);
    setCursor(initial.next_cursor);
    setError(null);
  }, [initial]);

  const loadMore = React.useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    setError(null);
    try {
      const page = await api<ListingPage>(endpointFor(filters), {
        query: { ...apiQuery(filters), cursor },
      });
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.next_cursor);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, filters]);

  // Infinite scroll; el botón "Cargar más" queda como alternativa accesible.
  React.useEffect(() => {
    const node = sentinel.current;
    if (!node || !cursor || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "600px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  function apply(next: SearchFilters) {
    setSheetOpen(false);
    router.push(
      `${basePath}${toQueryString(next, lockCategory ? ["category"] : [])}`,
    );
  }

  const chips = activeChips(filters, categories, lockCategory);
  const sortValue = filters.sort ?? (filters.q ? "relevance" : "newest");

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <aside className="hidden lg:block" aria-labelledby="filtros-desktop">
        <h2
          id="filtros-desktop"
          className="mb-4 font-heading text-h3 font-semibold"
        >
          Filtros
        </h2>
        <FiltersForm
          idPrefix="d"
          filters={filters}
          categories={categories}
          lockCategory={lockCategory}
          onApply={apply}
        />
      </aside>

      <section aria-label="Resultados" className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="lg:hidden">
                <SlidersHorizontal aria-hidden="true" />
                Filtros{chips.length ? ` (${chips.length})` : ""}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" aria-describedby={undefined}>
              <SheetTitle className="font-heading text-h2 font-semibold">
                Filtros
              </SheetTitle>
              <FiltersForm
                idPrefix="m"
                filters={filters}
                categories={categories}
                lockCategory={lockCategory}
                onApply={apply}
              />
            </SheetContent>
          </Sheet>
          <label
            className="ml-auto flex items-center gap-2 text-meta font-semibold"
            htmlFor="orden"
          >
            Ordenar
            <select
              id="orden"
              value={sortValue}
              onChange={(e) =>
                apply({ ...filters, sort: e.target.value as Sort })
              }
              className="select-chevron h-9 appearance-none rounded-input border border-border bg-card bg-no-repeat pl-3 pr-9 text-meta text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {SORTS.filter((s) => s.value !== "relevance" || filters.q).map(
                (s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>

        {chips.length ? (
          <ul className="flex flex-wrap gap-2" aria-label="Filtros activos">
            {chips.map((chip) => (
              <li key={chip.key}>
                <Link
                  href={`${basePath}${toQueryString(filters, [...chip.remove, ...(lockCategory ? (["category"] as const) : [])])}`}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-pill border border-border bg-card px-3 text-meta font-semibold text-foreground hover:border-primary"
                >
                  {chip.label}
                  <X aria-hidden="true" className="size-4" />
                  <span className="sr-only">Quitar filtro</span>
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={`${basePath}${toQueryString(filters.q ? { q: filters.q } : {})}`}
                className="inline-flex min-h-9 items-center px-2 text-meta font-semibold text-primary underline-offset-2 hover:underline"
              >
                Limpiar filtros
              </Link>
            </li>
          </ul>
        ) : null}

        {items.length === 0 ? (
          <EmptyState query={filters.q} hasFilters={chips.length > 0} />
        ) : (
          <>
            <p className="sr-only" aria-live="polite">
              {items.length} avisos cargados
            </p>
            <ListingGrid items={items} />
          </>
        )}

        {loading ? <ListingGridSkeleton count={4} /> : null}
        {error ? <FormMessage>{error}</FormMessage> : null}
        {cursor ? (
          <div ref={sentinel} className="flex justify-center py-4">
            <Button
              variant="outline"
              onClick={() => void loadMore()}
              disabled={loading}
            >
              {loading ? "Cargando…" : "Cargar más avisos"}
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function EmptyState({
  query,
  hasFilters,
}: {
  query?: string;
  hasFilters: boolean;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-card border border-dashed border-border bg-card p-6">
      <h2 className="font-heading text-h3 font-semibold">
        {query
          ? `No encontramos avisos para “${query}”`
          : "Todavía no hay avisos acá"}
      </h2>
      <p className="max-w-prose text-base text-muted-foreground">
        {hasFilters
          ? "Probá sacando algún filtro o buscando con otras palabras."
          : "Probá con otras palabras o mirá todas las categorías."}
      </p>
      <Button asChild variant="outline">
        <Link href="/publicar">Publicar un aviso</Link>
      </Button>
    </div>
  );
}

interface Chip {
  key: string;
  label: string;
  remove: (keyof SearchFilters)[];
}

function activeChips(
  filters: SearchFilters,
  categories: CategoryNode[],
  lockCategory?: boolean,
): Chip[] {
  const chips: Chip[] = [];
  if (filters.category && !lockCategory) {
    const all = categories.flatMap((c) => [c, ...c.children]);
    const name =
      all.find((c) => c.slug === filters.category)?.name ?? filters.category;
    chips.push({ key: "category", label: name, remove: ["category"] });
  }
  if (filters.department)
    chips.push({
      key: "department",
      label: filters.department,
      remove: ["department"],
    });
  if (filters.condition) {
    const label =
      CONDITIONS.find((c) => c.value === filters.condition)?.label ??
      filters.condition;
    chips.push({ key: "condition", label, remove: ["condition"] });
  }
  if (filters.currency) {
    chips.push({
      key: "currency",
      label: filters.currency === "USD" ? "En dólares" : "En pesos",
      remove: ["currency"],
    });
  }
  if (filters.price_min || filters.price_max) {
    const symbol = filters.currency === "USD" ? "US$" : "$";
    const fmt = (v: string) => `${symbol} ${Number(v).toLocaleString("es-AR")}`;
    const label =
      filters.price_min && filters.price_max
        ? `${fmt(filters.price_min)} a ${fmt(filters.price_max)}`
        : filters.price_min
          ? `Desde ${fmt(filters.price_min)}`
          : `Hasta ${fmt(filters.price_max!)}`;
    chips.push({ key: "price", label, remove: ["price_min", "price_max"] });
  }
  return chips;
}
