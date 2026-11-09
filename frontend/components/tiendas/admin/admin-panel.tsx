"use client";

import Link from "next/link";
import * as React from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { ConfigAdmin } from "@/components/tiendas/admin/config-admin";
import { EncargadosAdmin } from "@/components/tiendas/admin/encargados-admin";
import { GruposAdmin } from "@/components/tiendas/admin/grupos-admin";
import { PedidosAdmin } from "@/components/tiendas/admin/pedidos-admin";
import { ProductosAdmin } from "@/components/tiendas/admin/productos-admin";
import { FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CatalogoAdmin } from "@/lib/tiendas/types";

type Seccion = "pedidos" | "grupos" | "productos" | "config" | "encargados";

export function TiendaAdminPanel({ slug }: { slug: string }) {
  const { user } = useAuth();
  const [seccion, setSeccion] = React.useState<Seccion>("pedidos");
  const [catalogo, setCatalogo] = React.useState<CatalogoAdmin | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api<CatalogoAdmin>(`/admin/tiendas/${encodeURIComponent(slug)}/catalogo`)
      .then(setCatalogo)
      .catch((err) =>
        setError(
          err instanceof ApiError && err.status === 404
            ? "No administrás esta tienda."
            : errorMessage(err),
        ),
      );
  }, [slug]);

  if (error) return <FormMessage>{error}</FormMessage>;
  if (!catalogo) {
    return (
      <div aria-busy="true" className="flex flex-col gap-4">
        <span className="sr-only">Cargando…</span>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const { tienda } = catalogo;
  const secciones: { id: Seccion; label: string }[] = [
    { id: "pedidos", label: "Pedidos" },
    { id: "grupos", label: `${tienda.grupo_label}s` },
    { id: "productos", label: "Productos y precios" },
    { id: "config", label: "Envío y pagos" },
    ...(user?.role === "admin"
      ? [{ id: "encargados" as const, label: "Encargados" }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-h1 font-semibold">{tienda.nombre}</h1>
        <p className="text-meta text-muted-foreground">
          <Link
            href={`/tiendas/${tienda.slug}`}
            className="underline underline-offset-4 hover:text-primary"
          >
            Ver la tienda
          </Link>{" "}
          ·{" "}
          <Link
            href="/tiendas/admin"
            className="underline underline-offset-4 hover:text-primary"
          >
            Mis tiendas
          </Link>
        </p>
      </div>
      <div role="group" aria-label="Sección" className="flex flex-wrap gap-2">
        {secciones.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={seccion === s.id}
            onClick={() => setSeccion(s.id)}
            className={cn(
              "inline-flex min-h-11 items-center rounded-pill border px-4 text-base transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              seccion === s.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:border-primary",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      <h2 className="sr-only">
        {secciones.find((s) => s.id === seccion)?.label}
      </h2>
      {seccion === "pedidos" ? <PedidosAdmin slug={tienda.slug} /> : null}
      {seccion === "grupos" ? (
        <GruposAdmin
          tienda={tienda}
          grupos={catalogo.grupos}
          onChange={(grupos) => setCatalogo({ ...catalogo, grupos })}
        />
      ) : null}
      {seccion === "productos" ? (
        <ProductosAdmin catalogo={catalogo} onChange={setCatalogo} />
      ) : null}
      {seccion === "config" ? (
        <ConfigAdmin
          tienda={tienda}
          onSaved={(t) => setCatalogo({ ...catalogo, tienda: t })}
        />
      ) : null}
      {seccion === "encargados" ? <EncargadosAdmin slug={tienda.slug} /> : null}
    </div>
  );
}
