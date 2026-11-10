import { ArrowRight, Store } from "lucide-react";
import Link from "next/link";

import { GrupoCard } from "@/components/tiendas/grupo-card";
import type { TiendaEncontrada } from "@/lib/tiendas/types";

function plural(label: string) {
  const l = label.toLowerCase();
  return /[aeiou]$/.test(l) ? `${l}s` : `${l}es`;
}

/**
 * Lo que la búsqueda encontró en las tiendas (uniformes por colegio, por
 * ejemplo): no son avisos, así que van aparte y arriba de los resultados.
 */
export function TiendasEncontradas({
  encontradas,
}: {
  encontradas: TiendaEncontrada[];
}) {
  return encontradas.map(({ tienda, grupo_label, grupos, total_grupos }) => {
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
      </section>
    );
  });
}
