import { ArrowRight, Ruler, Truck, Wallet } from "lucide-react";
import Link from "next/link";

import { GrupoLogo } from "@/components/tiendas/grupo-logo";
import { Button } from "@/components/ui/button";
import { pesosLabel } from "@/lib/tiendas/cotizar";
import type { Tienda } from "@/lib/tiendas/types";
import { cn } from "@/lib/utils";

const MOSTRAR = 8;

/**
 * Bloque destacado de la tienda de uniformes en la portada (la campaña en
 * redes lleva acá). El precio "desde" viene del catálogo, nunca escrito a mano.
 */
export function UniformesDestacados({
  tienda,
  precioDesde,
}: {
  tienda: Tienda;
  precioDesde: number | null;
}) {
  const grupos = tienda.grupos.slice(0, MOSTRAR);
  const href = `/tiendas/${tienda.slug}`;
  const beneficios = [
    { icon: Truck, texto: "Envío a tu casa" },
    {
      icon: Wallet,
      texto: tienda.modalidades.includes("sena")
        ? `Reservás con ${tienda.sena_pct}% de seña`
        : "Pagás al recibir o en línea",
    },
    { icon: Ruler, texto: "Guía de talles en cm" },
  ];
  return (
    <section
      aria-labelledby="uniformes-destacados"
      className="grid overflow-hidden rounded-card border border-border bg-card lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
    >
      <div className="flex flex-col gap-4 bg-header p-5 text-header-foreground sm:p-7">
        <p className="text-meta font-semibold uppercase tracking-wide text-accent">
          Ciclo lectivo 2027
        </p>
        <h2
          id="uniformes-destacados"
          className="font-heading text-h1 font-semibold leading-tight"
        >
          Uniformes escolares
        </h2>
        <p className="text-header-muted">
          Buscá tu colegio, elegí las prendas y el talle, y te lo llevamos.
        </p>
        {precioDesde !== null ? (
          <p>
            <span className="text-header-muted">Prendas desde </span>
            <span className="font-heading text-h2 font-semibold text-accent">
              {pesosLabel(precioDesde)}
            </span>
          </p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {beneficios.map(({ icon: Icon, texto }) => (
            <li key={texto} className="flex items-center gap-2">
              <Icon
                aria-hidden="true"
                className="size-5 shrink-0 text-accent"
              />
              {texto}
            </li>
          ))}
        </ul>
        <Button
          asChild
          variant="accent"
          size="lg"
          className="mt-auto self-start"
        >
          <Link href={href}>Elegí tu colegio</Link>
        </Button>
      </div>
      <div className="flex flex-col gap-3 p-4 sm:p-6">
        <h3 className="font-heading text-h3 font-semibold">
          {tienda.grupos.length} colegios de San Juan
        </h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {grupos.map((g, i) => (
            // En el celular, 4 colegios y el enlace a todos.
            <li key={g.slug} className={i >= 4 ? "hidden sm:block" : undefined}>
              <Link
                href={`${href}/${g.slug}`}
                className="flex min-h-14 items-center gap-3 rounded-input border border-border px-3 py-2 transition-colors duration-200 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <GrupoLogo grupo={g} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {g.nombre}
                  </span>
                  {g.subtitulo ? (
                    <span className="text-meta text-muted-foreground">
                      {g.subtitulo}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {tienda.grupos.length > 4 ? (
          <Link
            href={href}
            className={cn(
              "inline-flex min-h-11 items-center gap-1 self-start font-semibold text-primary underline-offset-4 hover:underline",
              tienda.grupos.length <= MOSTRAR && "sm:hidden",
            )}
          >
            Ver los {tienda.grupos.length} colegios
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
      </div>
    </section>
  );
}
