import { CalendarDays, Check, ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  ConsultarPaquete,
  ReservarPaquete,
} from "@/components/transporte/paquete-acciones";
import { duracion } from "@/components/transporte/paquete-card";
import { pesosLabel } from "@/lib/tiendas/cotizar";
import { getPaquete, getTransportista } from "@/lib/transporte/server";

type Props = { params: { slug: string; paquete: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getPaquete(params.slug, params.paquete);
  if (!p) return {};
  return {
    title: p.titulo,
    description: `${p.resumen} Desde ${pesosLabel(p.precio_desde)} por persona.`,
    openGraph: p.foto_url ? { images: [p.foto_url] } : undefined,
  };
}

export default async function PaquetePage({ params }: Props) {
  const [t, p] = await Promise.all([
    getTransportista(params.slug),
    getPaquete(params.slug, params.paquete),
  ]);
  if (!t || !p) notFound();
  const dur = duracion(p);
  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/transporte/${t.slug}/paquetes`}
        className="inline-flex min-h-11 items-center gap-1 self-start text-meta font-semibold text-primary underline-offset-4 hover:underline"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        Todos los paquetes
      </Link>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_minmax(0,26rem)]">
        <article className="flex flex-col gap-5">
          {p.foto_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto del bucket
            <img
              src={p.foto_url}
              alt={p.titulo}
              className="aspect-[16/10] w-full rounded-card bg-muted object-cover"
            />
          ) : null}
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-h1 font-semibold">{p.titulo}</h1>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
              {dur ? (
                <span className="flex items-center gap-1.5">
                  <CalendarDays aria-hidden="true" className="size-4" />
                  {dur}
                </span>
              ) : null}
              <span>
                Desde{" "}
                <strong className="text-h3 text-foreground">
                  {pesosLabel(p.precio_desde)}
                </strong>{" "}
                por persona
              </span>
            </p>
            <p className="text-lg">{p.resumen}</p>
          </div>
          {p.incluye.length ? (
            <section aria-labelledby="incluye" className="flex flex-col gap-2">
              <h2 id="incluye" className="font-heading text-h2 font-semibold">
                El viaje incluye
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {p.incluye.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check
                      aria-hidden="true"
                      className="mt-0.5 size-5 shrink-0 text-success"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {p.descripcion ? (
            <section aria-labelledby="detalle" className="flex flex-col gap-2">
              <h2 id="detalle" className="font-heading text-h2 font-semibold">
                Detalle
              </h2>
              <p className="whitespace-pre-line text-muted-foreground">
                {p.descripcion}
              </p>
            </section>
          ) : null}
        </article>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-36">
          <ReservarPaquete transportista={t.slug} paquete={p} />
          <ConsultarPaquete
            transportista={t.slug}
            paquete={p.slug}
            whatsappUrl={p.whatsapp_url}
          />
        </aside>
      </div>
    </div>
  );
}
