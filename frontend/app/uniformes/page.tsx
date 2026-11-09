import type { Metadata } from "next";

import { ColegioExplorer } from "@/components/uniformes/colegio-explorer";
import { FormMessage } from "@/components/ui/form";
import { serverGet } from "@/lib/api";
import { pesosLabel } from "@/lib/uniformes/cotizar";
import type { Catalogo } from "@/lib/uniformes/types";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Uniformes escolares en San Juan",
  description:
    "Comprá el uniforme de tu colegio en San Juan: elegí prendas y talles, pagá una seña con Mercado Pago y recibilo en tu casa.",
  alternates: { canonical: "/uniformes" },
};

export default async function UniformesPage() {
  const catalogo = await serverGet<Catalogo>(
    "/uniformes/catalogo",
    undefined,
    300,
  ).catch(() => null);
  if (!catalogo) {
    return (
      <FormMessage>
        No pudimos cargar la tienda. Probá de nuevo en unos minutos.
      </FormMessage>
    );
  }
  const { config } = catalogo;
  return (
    <div className="flex flex-col gap-8">
      <section className="flex max-w-2xl flex-col gap-3">
        <h1 className="font-heading text-h1 font-semibold text-foreground md:text-display">
          El uniforme de tu colegio, en tu casa
        </h1>
        <p className="text-muted-foreground">
          Elegí el colegio, las prendas y los talles. Pagás una seña del{" "}
          {config.sena_pct}% más el envío (o el total) y el resto cuando lo
          recibís. Envío al Gran San Juan: {pesosLabel(config.envio_monto)}, en
          48 hs.
        </p>
      </section>
      <ColegioExplorer catalogo={catalogo} />
    </div>
  );
}
