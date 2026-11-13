import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConsultarPaquete } from "@/components/transporte/paquete-acciones";
import { PaqueteCard } from "@/components/transporte/paquete-card";
import { getPaquetes, getTransportista } from "@/lib/transporte/server";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTransportista(params.slug);
  if (!t) return {};
  return {
    title: `Paquetes de viaje · ${t.nombre.split(" · ")[0]}`,
    description: `Paquetes turísticos con salida desde San Juan: reservá tu lugar con seña. ${t.nombre}.`,
  };
}

export default async function PaquetesPage({ params }: Props) {
  const [t, paquetes] = await Promise.all([
    getTransportista(params.slug),
    getPaquetes(params.slug),
  ]);
  if (!t || !paquetes) notFound();
  const empresa = t.nombre.split(" · ")[0];
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-meta font-semibold uppercase tracking-wide text-primary">
          Agencia de viajes · {empresa}
        </p>
        <h1 className="font-heading text-h1 font-semibold">
          Paquetes de viaje
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Transporte, alojamiento y coordinación en un solo lugar. Elegí la
          salida, reservá tu lugar con seña y pagá el resto antes de viajar.
        </p>
      </div>
      {paquetes.length === 0 ? (
        <p className="text-muted-foreground">
          Pronto vamos a publicar nuevos paquetes.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paquetes.map((p) => (
            <li key={p.slug}>
              <PaqueteCard transportista={t.slug} paquete={p} />
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <ConsultarPaquete transportista={t.slug} whatsappUrl={t.whatsapp_url} />
        <section className="flex flex-col justify-center gap-2 rounded-card bg-header p-5 text-header-foreground">
          <h2 className="font-heading text-h3 font-semibold">
            ¿Viajan como empresa o grupo?
          </h2>
          <p className="text-header-muted">
            Cotizá un traslado a medida con el precio al instante.
          </p>
          <Link
            href={`/transporte/${t.slug}`}
            className="self-start font-semibold text-accent underline underline-offset-4"
          >
            Ir al cotizador de traslados
          </Link>
        </section>
      </div>
    </div>
  );
}
