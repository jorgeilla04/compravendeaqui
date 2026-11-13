import { Clock, ShieldCheck, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Cotizador } from "@/components/transporte/cotizador";
import { PaqueteCard } from "@/components/transporte/paquete-card";
import { getPaquetes, getTransportista } from "@/lib/transporte/server";

type Props = { params: { slug: string } };

const VALORES = [
  {
    icon: ShieldCheck,
    titulo: "Seguridad",
    texto: "Unidades habilitadas y choferes profesionales.",
  },
  {
    icon: Clock,
    titulo: "Puntualidad",
    texto: "Cumplimos horarios: tu equipo no espera.",
  },
  {
    icon: Trophy,
    titulo: "Experiencia",
    texto: "Más de 17 años moviendo gente en la región.",
  },
];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTransportista(params.slug);
  if (!t) return {};
  return {
    title: t.nombre,
    description: t.descripcion ?? undefined,
    openGraph: t.foto_url ? { images: [t.foto_url] } : undefined,
  };
}

export default async function TransportePage({ params }: Props) {
  const [transportista, paquetes] = await Promise.all([
    getTransportista(params.slug),
    getPaquetes(params.slug),
  ]);
  if (!transportista) notFound();
  return (
    <div className="flex flex-col gap-6">
      <section className="relative isolate overflow-hidden rounded-card bg-header text-header-foreground">
        {transportista.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto del bucket
          <img
            src={transportista.foto_url}
            alt=""
            className="absolute inset-0 -z-10 size-full object-cover"
          />
        ) : null}
        <div className="flex min-h-64 flex-col justify-end gap-3 bg-gradient-to-t from-[rgb(14_22_42/0.92)] via-[rgb(14_22_42/0.6)] to-[rgb(14_22_42/0.1)] p-5 sm:min-h-80 sm:p-8">
          <p className="text-meta font-semibold uppercase tracking-wide text-accent">
            Transporte para empresas
          </p>
          <h1 className="max-w-2xl font-heading text-h1 font-semibold">
            {transportista.nombre}
          </h1>
          {transportista.descripcion ? (
            <p className="max-w-2xl text-header-muted">
              {transportista.descripcion}
            </p>
          ) : null}
        </div>
      </section>
      <ul className="grid gap-3 sm:grid-cols-3">
        {VALORES.map(({ icon: Icon, titulo, texto }) => (
          <li
            key={titulo}
            className="flex items-start gap-3 rounded-card border border-border bg-card p-4"
          >
            <Icon
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-primary"
            />
            <span>
              <span className="block font-semibold">{titulo}</span>
              <span className="text-meta text-muted-foreground">{texto}</span>
            </span>
          </li>
        ))}
      </ul>
      <Cotizador transportista={transportista} />
      {paquetes?.length ? (
        <section
          aria-labelledby="paquetes-titulo"
          className="flex flex-col gap-3"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2
              id="paquetes-titulo"
              className="font-heading text-h2 font-semibold"
            >
              Paquetes de viaje
            </h2>
            <Link
              href={`/transporte/${transportista.slug}/paquetes`}
              className="inline-flex min-h-11 items-center text-meta font-semibold text-primary underline-offset-4 hover:underline"
            >
              Ver los {paquetes.length} paquetes
            </Link>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paquetes.slice(0, 3).map((p) => (
              <li key={p.slug}>
                <PaqueteCard transportista={transportista.slug} paquete={p} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
