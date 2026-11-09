import type { Metadata } from "next";
import Link from "next/link";

import { FormMessage } from "@/components/ui/form";
import { serverGet } from "@/lib/api";
import type { TiendaResumen } from "@/lib/tiendas/types";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Tiendas",
  description:
    "Tiendas de San Juan con envío a tu casa: uniformes escolares y más. Pagás con Mercado Pago.",
  alternates: { canonical: "/tiendas" },
};

export default async function TiendasPage() {
  const tiendas = await serverGet<TiendaResumen[]>(
    "/tiendas",
    undefined,
    300,
  ).catch(() => null);
  return (
    <div className="flex flex-col gap-8">
      <section className="flex max-w-2xl flex-col gap-3">
        <h1 className="font-heading text-h1 font-semibold md:text-display">
          Tiendas
        </h1>
        <p className="text-muted-foreground">
          Comercios de San Juan que venden por acá, con envío a tu casa o retiro
          en el local.
        </p>
      </section>
      {tiendas === null ? (
        <FormMessage>
          No pudimos cargar las tiendas. Probá de nuevo en unos minutos.
        </FormMessage>
      ) : tiendas.length === 0 ? (
        <p className="text-muted-foreground">
          Todavía no hay tiendas abiertas.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiendas.map((t) => (
            <li key={t.slug}>
              <Link
                href={`/tiendas/${t.slug}`}
                className="flex h-full flex-col gap-2 rounded-card border border-border bg-card p-5 transition-colors duration-200 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="font-heading text-h2 font-semibold text-foreground">
                  {t.nombre}
                </span>
                {t.descripcion ? (
                  <span className="text-muted-foreground">{t.descripcion}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
