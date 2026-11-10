import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GrupoLogo } from "@/components/tiendas/grupo-logo";
import { ProductoCard } from "@/components/tiendas/producto-card";
import { serverGet } from "@/lib/api";
import { getTienda } from "@/lib/tiendas/server";
import type { GrupoDetalle } from "@/lib/tiendas/types";

export const revalidate = 60;

type Props = { params: { tienda: string; grupo: string } };

function getGrupo(tienda: string, grupo: string): Promise<GrupoDetalle | null> {
  return serverGet<GrupoDetalle>(
    `/tiendas/${encodeURIComponent(tienda)}/grupos/${encodeURIComponent(grupo)}`,
    undefined,
    60,
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [tienda, grupo] = await Promise.all([
    getTienda(params.tienda).catch(() => null),
    getGrupo(params.tienda, params.grupo).catch(() => null),
  ]);
  if (!tienda || !grupo) return { title: "No encontrado" };
  return {
    title: `${grupo.nombre} · ${tienda.nombre}`,
    description: `${tienda.nombre}: ${grupo.nombre}${
      grupo.subtitulo ? ` (${grupo.subtitulo})` : ""
    }, con envío a tu casa en San Juan.`,
    alternates: { canonical: `/tiendas/${tienda.slug}/${grupo.slug}` },
  };
}

export default async function GrupoPage({ params }: Props) {
  const [tienda, grupo] = await Promise.all([
    getTienda(params.tienda),
    getGrupo(params.tienda, params.grupo),
  ]);
  if (!tienda || !grupo) notFound();
  return (
    <div className="flex flex-col gap-6">
      <nav
        aria-label="Migas de pan"
        className="text-meta text-muted-foreground"
      >
        <Link
          href={`/tiendas/${tienda.slug}`}
          className="underline underline-offset-4 hover:text-primary"
        >
          {tienda.nombre}
        </Link>{" "}
        / <span aria-current="page">{grupo.nombre}</span>
      </nav>
      <header className="flex items-center gap-4">
        <GrupoLogo grupo={grupo} size="lg" />
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-h1 font-semibold">{grupo.nombre}</h1>
          <p className="text-muted-foreground">
            {grupo.subtitulo ? `${grupo.subtitulo} · ` : ""}Elegí los productos
            {tienda.opcion_label
              ? ` y ${tienda.opcion_label.toLowerCase()}`
              : ""}
            .
          </p>
        </div>
      </header>
      {grupo.fotos?.length ? (
        <section aria-label={`Fotos del uniforme de ${grupo.nombre}`}>
          <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {grupo.fotos.map((url, i) => (
              <li
                key={url}
                className="w-72 shrink-0 snap-start overflow-hidden rounded-card border border-border bg-muted sm:w-80"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- foto del bucket */}
                <img
                  src={url}
                  alt={`Uniforme de ${grupo.nombre}, foto ${i + 1} de ${grupo.fotos.length}`}
                  loading={i === 0 ? "eager" : "lazy"}
                  className="aspect-square size-full object-contain"
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {grupo.productos.length === 0 ? (
        <p className="text-muted-foreground">
          Todavía no hay productos cargados acá.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {grupo.productos.map((producto) => (
            <ProductoCard
              key={producto.slug}
              grupo={grupo}
              producto={producto}
              opcionLabel={tienda.opcion_label}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
