"use client";

import * as React from "react";

import { ColegiosAdmin } from "@/components/uniformes/admin/colegios-admin";
import { PedidosAdmin } from "@/components/uniformes/admin/pedidos-admin";
import { PreciosAdmin } from "@/components/uniformes/admin/precios-admin";
import { FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CatalogoAdmin } from "@/lib/uniformes/types";

const SECCIONES = [
  { id: "pedidos", label: "Pedidos" },
  { id: "colegios", label: "Colegios" },
  { id: "precios", label: "Precios y fotos" },
] as const;
type Seccion = (typeof SECCIONES)[number]["id"];

export function AdminPanel() {
  const [seccion, setSeccion] = React.useState<Seccion>("pedidos");
  const [catalogo, setCatalogo] = React.useState<CatalogoAdmin | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api<CatalogoAdmin>("/admin/uniformes/catalogo")
      .then(setCatalogo)
      .catch((err) =>
        setError(
          err instanceof ApiError && err.status === 403
            ? "Esta sección es solo para administradores de la tienda."
            : errorMessage(err),
        ),
      );
  }, []);

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

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-h1 font-semibold">
        Administrar la tienda
      </h1>
      <div role="group" aria-label="Sección" className="flex flex-wrap gap-2">
        {SECCIONES.map((s) => (
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
        {SECCIONES.find((s) => s.id === seccion)?.label}
      </h2>
      {seccion === "pedidos" ? <PedidosAdmin /> : null}
      {seccion === "colegios" ? (
        <ColegiosAdmin
          colegios={catalogo.colegios}
          onChange={(colegios) => setCatalogo({ ...catalogo, colegios })}
        />
      ) : null}
      {seccion === "precios" ? (
        <PreciosAdmin catalogo={catalogo} onChange={setCatalogo} />
      ) : null}
    </div>
  );
}
