import { ArrowRight, Store } from "lucide-react";
import Link from "next/link";

import { GrupoCard } from "@/components/tiendas/grupo-card";
import { pesosLabel } from "@/lib/tiendas/cotizar";
import type { TiendaEncontrada } from "@/lib/tiendas/types";

function plural(label: string) {
  const l = label.toLowerCase();
  return /[aeiou]$/.test(l) ? `${l}s` : `${l}es`;
}

/**
 * Lo que la búsqueda encontró en las tiendas (uniformes por colegio, por
 * ejemplo): no son avisos, así que van aparte y arriba de los resultados.
 */
/** Lo buscado sin las palabras que nombran a la tienda ("uniformes de…"). */
function sinGenericas(q: string, label: string): string {
  const genericas = new Set([
    "uniforme",
    "uniformes",
    "escolar",
    "escolares",
    "de",
    "del",
    "la",
    "el",
    "para",
  ]);
  const l = label.toLowerCase();
  return q
    .split(/\s+/)
    .filter((w) => w && !genericas.has(w.toLowerCase()))
    .filter(
      (w, i) =>
        i > 0 || !w.toLowerCase().startsWith(l) || w.length > l.length + 2,
    )
    .join(" ");
}

export function TiendasEncontradas({
  encontradas,
  q = "",
}: {
  encontradas: TiendaEncontrada[];
  q?: string;
}) {
  return encontradas.map((encontrada) => {
    const { tienda, grupo_label, grupos, total_grupos } = encontrada;
    const productos = encontrada.productos ?? [];
    const totalProductos = encontrada.total_productos ?? productos.length;
    const id = `tienda-${tienda.slug}`;
    const todos =
      total_grupos > grupos.length || grupos.length === 0
        ? `Ver ${total_grupos > 1 ? `los ${total_grupos} ${plural(grupo_label)}` : "la tienda"}`
        : null;
    return (
      <section
        key={tienda.slug}
        aria-labelledby={id}
        className="flex flex-col gap-3 rounded-card border border-border bg-card p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h2
            id={id}
            className="flex items-center gap-2 font-heading text-h3 font-semibold"
          >
            <Store aria-hidden="true" className="size-5 text-primary" />
            <Link
              href={`/tiendas/${tienda.slug}`}
              className="underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {tienda.nombre}
            </Link>
          </h2>
          {todos ? (
            <Link
              href={`/tiendas/${tienda.slug}`}
              className="inline-flex min-h-11 items-center gap-1 text-meta font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {todos}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          ) : null}
        </div>
        {tienda.descripcion ? (
          <p className="text-meta text-muted-foreground">
            {tienda.descripcion}
          </p>
        ) : null}
        {grupos.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {grupos.map((grupo) => (
              <li key={grupo.slug}>
                <GrupoCard tienda={tienda.slug} grupo={grupo} />
              </li>
            ))}
          </ul>
        ) : null}
        {productos.length > 0 ? (
          <>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {productos.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/tiendas/${tienda.slug}/${p.grupo}#producto-${p.slug}`}
                    className="flex h-full flex-col overflow-hidden rounded-card border border-border bg-background transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex aspect-square items-center justify-center bg-muted p-2">
                      {p.foto_url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- foto del bucket
                        <img
                          src={p.foto_url}
                          alt=""
                          loading="lazy"
                          className="size-full object-contain"
                        />
                      ) : null}
                    </div>
                    <div className="flex flex-1 flex-col gap-1 p-3">
                      <span className="line-clamp-2 text-meta font-medium">
                        {p.nombre}
                      </span>
                      <span className="mt-auto font-heading font-semibold">
                        {pesosLabel(p.precio)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {totalProductos > productos.length ? (
              <p className="text-meta text-muted-foreground">
                Y {totalProductos - productos.length} productos más en{" "}
                <Link
                  href={`/tiendas/${tienda.slug}`}
                  className="font-semibold text-primary underline underline-offset-4"
                >
                  {tienda.nombre}
                </Link>
                .
              </p>
            ) : null}
          </>
        ) : null}
        {grupos.length === 0 &&
        productos.length === 0 &&
        sinGenericas(q, grupo_label) ? (
          <p className="text-meta">
            ¿No está tu {grupo_label.toLowerCase()}?{" "}
            <Link
              href={`/tiendas/${tienda.slug}?${new URLSearchParams({ colegio: sinGenericas(q, grupo_label) })}#no-esta`}
              className="font-semibold text-primary underline underline-offset-4"
            >
              Preguntanos por el tuyo
            </Link>
          </p>
        ) : null}
      </section>
    );
  });
}
