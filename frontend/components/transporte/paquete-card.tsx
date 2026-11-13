import { CalendarDays } from "lucide-react";
import Link from "next/link";

import { pesosLabel } from "@/lib/tiendas/cotizar";
import type { PaqueteResumen } from "@/lib/transporte/types";

export function duracion(p: Pick<PaqueteResumen, "dias" | "noches">) {
  if (!p.dias) return null;
  return p.noches != null
    ? `${p.dias} días · ${p.noches} noches`
    : `${p.dias} días`;
}

/** Tarjeta de un paquete en el listado de la agencia. */
export function PaqueteCard({
  transportista,
  paquete,
}: {
  transportista: string;
  paquete: PaqueteResumen;
}) {
  return (
    <Link
      href={`/transporte/${transportista}/paquetes/${paquete.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-card border border-border bg-card transition-colors duration-200 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="aspect-[4/3] overflow-hidden bg-muted">
        {paquete.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto del bucket
          <img
            src={paquete.foto_url}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : null}
      </span>
      <span className="flex flex-1 flex-col gap-1.5 p-4">
        <span className="font-heading text-h3 font-semibold leading-snug">
          {paquete.titulo}
        </span>
        {duracion(paquete) ? (
          <span className="flex items-center gap-1.5 text-meta text-muted-foreground">
            <CalendarDays aria-hidden="true" className="size-4" />
            {duracion(paquete)}
          </span>
        ) : null}
        <span className="line-clamp-2 text-meta text-muted-foreground">
          {paquete.resumen}
        </span>
        <span className="mt-auto pt-2">
          <span className="text-meta text-muted-foreground">Desde </span>
          <span className="text-h3 font-semibold tabular-nums">
            {pesosLabel(paquete.precio_desde)}
          </span>
          <span className="text-meta text-muted-foreground"> por persona</span>
        </span>
      </span>
    </Link>
  );
}
