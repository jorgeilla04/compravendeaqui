"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { GrupoLogo } from "@/components/tiendas/grupo-logo";
import { cn } from "@/lib/utils";
import type { Grupo, Tienda } from "@/lib/tiendas/types";

/** Sin tildes ni mayúsculas: "santa lucia" encuentra "Santa Lucía". */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function filterGrupos(
  grupos: Grupo[],
  query: string,
  categoria: string | null,
): Grupo[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return grupos.filter((g) => {
    if (categoria && g.categoria !== categoria) return false;
    const haystack = normalize(`${g.nombre} ${g.subtitulo ?? ""}`);
    return terms.every((t) => haystack.includes(t));
  });
}

const chip =
  "inline-flex min-h-11 shrink-0 items-center rounded-pill border px-4 text-base transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function GrupoExplorer({ tienda }: { tienda: Tienda }) {
  const [query, setQuery] = React.useState("");
  const [categoria, setCategoria] = React.useState<string | null>(null);
  const label = tienda.grupo_label.toLowerCase();
  const found = filterGrupos(tienda.grupos, query, categoria);
  const usadas = tienda.categorias.filter((c) =>
    tienda.grupos.some((g) => g.categoria === c),
  );
  const sinCategoria = found.filter(
    (g) => !g.categoria || !usadas.includes(g.categoria),
  );
  const groups = [
    ...usadas.map((nombre) => ({
      nombre,
      grupos: found.filter((g) => g.categoria === nombre),
    })),
    ...(sinCategoria.length
      ? [{ nombre: usadas.length ? "Otros" : "", grupos: sinCategoria }]
      : []),
  ].filter((g) => g.grupos.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <label htmlFor="buscar-grupo" className="font-semibold text-foreground">
          Buscá tu {label}
        </label>
        <div className="relative max-w-xl">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
          />
          <input
            id="buscar-grupo"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Escribí el nombre"
            autoComplete="off"
            className="h-12 w-full rounded-input border border-border bg-card pl-10 pr-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        {usadas.length > 1 ? (
          <div
            role="group"
            aria-label="Filtrar por categoría"
            className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
          >
            {[null, ...usadas].map((cat) => {
              const active = categoria === cat;
              return (
                <button
                  key={cat ?? "todas"}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategoria(cat)}
                  className={cn(
                    chip,
                    "snap-start",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:border-primary",
                  )}
                >
                  {cat ?? "Todos"}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <p className="sr-only" aria-live="polite">
        {found.length === 1 ? `1 resultado` : `${found.length} resultados`}
      </p>

      {tienda.grupos.length === 0 ? (
        <div className="flex max-w-prose flex-col gap-3 rounded-card border border-border bg-card p-6">
          <h2 className="font-heading text-h2 font-semibold">
            Estamos cargando el catálogo
          </h2>
          <p className="text-muted-foreground">
            En unos días vas a poder comprar acá. Si lo necesitás ya, escribile
            a {tienda.vendedor_nombre}.
          </p>
          <a
            href={tienda.whatsapp_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary underline underline-offset-4"
          >
            Consultar por WhatsApp
          </a>
        </div>
      ) : groups.length === 0 ? (
        <p className="text-muted-foreground">
          No encontramos “{query}”. Probá con otra palabra o escribile a{" "}
          {tienda.vendedor_nombre}{" "}
          <a
            href={tienda.whatsapp_url}
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
            key={group.nombre || "todos"}
            aria-label={group.nombre || tienda.grupo_label}
            className="flex flex-col gap-3"
          >
            {group.nombre ? (
              <h2 className="font-heading text-h2 font-semibold">
                {group.nombre}
              </h2>
            ) : null}
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.grupos.map((grupo) => (
                <li key={grupo.slug}>
                  <Link
                    href={`/tiendas/${tienda.slug}/${grupo.slug}`}
                    className="flex min-h-20 items-center gap-3 rounded-card border border-border bg-card p-3 transition-colors duration-200 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex w-28 shrink-0 justify-center">
                      <GrupoLogo grupo={grupo} />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="font-semibold text-foreground">
                        {grupo.nombre}
                      </span>
                      {grupo.subtitulo ? (
                        <span className="text-meta text-muted-foreground">
                          {grupo.subtitulo}
                        </span>
                      ) : null}
                    </span>
                    <span
                      aria-hidden="true"
                      className="ml-auto flex shrink-0 -space-x-1.5"
                    >
                      <span
                        className="size-5 rounded-full border border-border"
                        style={{ background: grupo.color1 }}
                      />
                      <span
                        className="size-5 rounded-full border border-border"
                        style={{ background: grupo.color2 }}
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
