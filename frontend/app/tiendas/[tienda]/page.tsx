import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GrupoExplorer } from "@/components/tiendas/grupo-explorer";
import { condiciones } from "@/lib/tiendas/condiciones";
import { getTienda } from "@/lib/tiendas/server";

export const revalidate = 60;

type Props = { params: { tienda: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tienda = await getTienda(params.tienda).catch(() => null);
  if (!tienda) return { title: "Tienda no encontrada" };
  return {
    title: `${tienda.nombre} en San Juan`,
    description:
      tienda.descripcion ??
      `Comprá en ${tienda.nombre} con envío a tu casa y pago con Mercado Pago.`,
    alternates: { canonical: `/tiendas/${tienda.slug}` },
  };
}

export default async function TiendaPage({ params }: Props) {
  const tienda = await getTienda(params.tienda);
  if (!tienda) notFound();
  return (
    <div className="flex flex-col gap-8">
      <section className="flex max-w-2xl flex-col gap-3">
        <h1 className="font-heading text-h1 font-semibold text-foreground md:text-display">
          {tienda.nombre}
        </h1>
        {tienda.descripcion ? (
          <p className="text-muted-foreground">{tienda.descripcion}</p>
        ) : null}
        <ul className="flex flex-col gap-1 text-meta text-muted-foreground">
          {condiciones(tienda).map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </section>
      <GrupoExplorer tienda={tienda} />
    </div>
  );
}
