import Link from "next/link";

import { GrupoLogo } from "@/components/tiendas/grupo-logo";
import type { Grupo } from "@/lib/tiendas/types";

/** Tarjeta de un grupo (colegio) que lleva a su catálogo. */
export function GrupoCard({ tienda, grupo }: { tienda: string; grupo: Grupo }) {
  return (
    <Link
      href={`/tiendas/${tienda}/${grupo.slug}`}
      className="flex min-h-20 items-center gap-3 rounded-card border border-border bg-card p-3 transition-colors duration-200 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex w-28 shrink-0 justify-center">
        <GrupoLogo grupo={grupo} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold text-foreground">{grupo.nombre}</span>
        {grupo.subtitulo ? (
          <span className="text-meta text-muted-foreground">
            {grupo.subtitulo}
          </span>
        ) : null}
      </span>
      <span aria-hidden="true" className="ml-auto flex shrink-0 -space-x-1.5">
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
  );
}
