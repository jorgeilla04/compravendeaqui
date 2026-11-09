import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Escudo } from "@/components/uniformes/escudo";
import { PrendaCard } from "@/components/uniformes/prenda-card";
import { serverGet } from "@/lib/api";
import type { ColegioDetalle } from "@/lib/uniformes/types";

export const revalidate = 300;

type Props = { params: { colegio: string } };

async function getColegio(slug: string): Promise<ColegioDetalle | null> {
  return serverGet<ColegioDetalle>(
    `/uniformes/colegios/${encodeURIComponent(slug)}`,
    undefined,
    300,
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const colegio = await getColegio(params.colegio).catch(() => null);
  if (!colegio) return { title: "Colegio no encontrado" };
  return {
    title: `Uniforme ${colegio.nombre}`,
    description: `Uniforme escolar de ${colegio.nombre} (${colegio.departamento}, San Juan): remeras, pantalones, buzos y más, con envío a domicilio.`,
    alternates: { canonical: `/uniformes/${colegio.slug}` },
  };
}

export default async function ColegioPage({ params }: Props) {
  const colegio = await getColegio(params.colegio);
  if (!colegio) notFound();
  return (
    <div className="flex flex-col gap-6">
      <nav
        aria-label="Migas de pan"
        className="text-meta text-muted-foreground"
      >
        <Link
          href="/uniformes"
          className="underline underline-offset-4 hover:text-primary"
        >
          Colegios
        </Link>{" "}
        / <span aria-current="page">{colegio.nombre}</span>
      </nav>
      <header className="flex items-center gap-4">
        <Escudo colegio={colegio} size="lg" />
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-h1 font-semibold">
            {colegio.nombre}
          </h1>
          <p className="text-muted-foreground">
            {colegio.departamento} · Elegí las prendas y el talle de cada una.
          </p>
        </div>
      </header>
      {colegio.prendas.length === 0 ? (
        <p className="text-muted-foreground">
          Todavía no cargamos las prendas de este colegio.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {colegio.prendas.map((prenda) => (
            <PrendaCard key={prenda.slug} colegio={colegio} prenda={prenda} />
          ))}
        </ul>
      )}
    </div>
  );
}
