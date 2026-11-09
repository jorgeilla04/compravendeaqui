"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Escudo } from "@/components/uniformes/escudo";
import { cn } from "@/lib/utils";
import type { Catalogo, CategoriaSlug, Colegio } from "@/lib/uniformes/types";

/** Sin tildes ni mayúsculas: "santa lucia" encuentra "Santa Lucía". */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function filterColegios(
  colegios: Colegio[],
  query: string,
  categoria: CategoriaSlug | null,
): Colegio[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return colegios.filter((c) => {
    if (categoria && c.categoria !== categoria) return false;
    const haystack = normalize(`${c.nombre} ${c.departamento}`);
    return terms.every((t) => haystack.includes(t));
  });
}

const chip =
  "inline-flex min-h-11 shrink-0 items-center rounded-pill border px-4 text-base transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ColegioExplorer({ catalogo }: { catalogo: Catalogo }) {
  const [query, setQuery] = React.useState("");
  const [categoria, setCategoria] = React.useState<CategoriaSlug | null>(null);
  const found = filterColegios(catalogo.colegios, query, categoria);
  const groups = catalogo.categorias
    .map((cat) => ({
      ...cat,
      colegios: found.filter((c) => c.categoria === cat.slug),
    }))
    .filter((g) => g.colegios.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <label
          htmlFor="buscar-colegio"
          className="font-semibold text-foreground"
        >
          Buscá tu colegio
        </label>
        <div className="relative max-w-xl">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
          />
          <input
            id="buscar-colegio"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nombre o departamento"
            autoComplete="off"
            className="h-12 w-full rounded-input border border-border bg-card pl-10 pr-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div
          role="group"
          aria-label="Filtrar por tipo de colegio"
          className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        >
          {[{ slug: null, nombre: "Todos" }, ...catalogo.categorias].map(
            (cat) => {
              const active = categoria === cat.slug;
              return (
                <button
                  key={cat.slug ?? "todos"}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategoria(cat.slug as CategoriaSlug | null)}
                  className={cn(
                    chip,
                    "snap-start",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:border-primary",
                  )}
                >
                  {cat.nombre}
                </button>
              );
            },
          )}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {found.length === 1 ? "1 colegio" : `${found.length} colegios`}
      </p>

      {catalogo.colegios.length === 0 ? (
        <div className="flex max-w-prose flex-col gap-3 rounded-card border border-border bg-card p-6">
          <h2 className="font-heading text-h2 font-semibold">
            Estamos cargando los colegios
          </h2>
          <p className="text-muted-foreground">
            En unos días vas a poder elegir el uniforme de tu colegio acá. Si lo
            necesitás ya, escribile a {catalogo.config.vendedora_nombre}.
          </p>
          <a
            href={catalogo.config.vendedora_whatsapp_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary underline underline-offset-4"
          >
            Consultar por WhatsApp
          </a>
        </div>
      ) : groups.length === 0 ? (
        <p className="text-muted-foreground">
          No encontramos colegios con “{query}”. Probá con otra palabra o
          escribile a {catalogo.config.vendedora_nombre}{" "}
          <a
            href={catalogo.config.vendedora_whatsapp_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary underline underline-offset-4"
          >
            por WhatsApp
          </a>
          .
        </p>
      ) : (
        groups.map((group) => (
          <section
            key={group.slug}
            aria-labelledby={`cat-${group.slug}`}
            className="flex flex-col gap-3"
          >
            <h2
              id={`cat-${group.slug}`}
              className="font-heading text-h2 font-semibold"
            >
              {group.nombre}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.colegios.map((colegio) => (
                <li key={colegio.slug}>
                  <Link
                    href={`/uniformes/${colegio.slug}`}
                    className="flex min-h-20 items-center gap-3 rounded-card border border-border bg-card p-3 transition-colors duration-200 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Escudo colegio={colegio} />
                    <span className="flex min-w-0 flex-col">
                      <span className="font-semibold text-foreground">
                        {colegio.nombre}
                      </span>
                      <span className="text-meta text-muted-foreground">
                        {colegio.departamento}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="ml-auto flex shrink-0 -space-x-1.5"
                    >
                      <span
                        className="size-5 rounded-full border border-border"
                        style={{ background: colegio.color1 }}
                      />
                      <span
                        className="size-5 rounded-full border border-border"
                        style={{ background: colegio.color2 }}
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
