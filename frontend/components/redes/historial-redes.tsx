"use client";

import Link from "next/link";
import * as React from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { EstadoPublicacion } from "@/components/redes/estado-publicacion";
import { FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import type { PublicacionListado, Red } from "@/lib/redes";

/** Historial de publicaciones en redes (solo administradores). */
export function HistorialRedes() {
  const { user } = useAuth();
  const [lista, setLista] = React.useState<PublicacionListado[] | null>(null);
  const [estado, setEstado] = React.useState<Record<Red, boolean> | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (user?.role !== "admin") return;
    api<PublicacionListado[]>("/admin/redes")
      .then(setLista)
      .catch((err) => setError(errorMessage(err)));
    api<Record<Red, boolean>>("/admin/redes/estado")
      .then(setEstado)
      .catch(() => undefined);
  }, [user?.role]);

  if (user && user.role !== "admin") {
    return (
      <FormMessage>Esta sección es solo para administradores.</FormMessage>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-h1 font-semibold">Redes sociales</h1>
        <p className="max-w-prose text-muted-foreground">
          Para publicar una oferta, abrí el aviso (o la página de un colegio,
          para los uniformes) y usá &quot;Publicar en redes&quot;. Acá ves todo
          lo publicado.
        </p>
        {estado ? (
          <p className="text-meta">
            Facebook:{" "}
            <strong>{estado.facebook ? "conectado" : "sin conectar"}</strong>
            {" · "}Instagram:{" "}
            <strong>{estado.instagram ? "conectado" : "sin conectar"}</strong>
          </p>
        ) : null}
      </div>
      {error ? <FormMessage>{error}</FormMessage> : null}
      {lista === null && !error ? <Skeleton className="h-32 w-full" /> : null}
      {lista?.length === 0 ? (
        <p className="text-muted-foreground">Todavía no se publicó nada.</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {lista?.map((p) => (
          <EstadoPublicacion
            key={p.id}
            publicacion={p}
            titulo={
              <Link
                href={p.aviso_url}
                className="font-semibold text-foreground underline-offset-4 hover:underline"
              >
                {p.aviso_titulo}
              </Link>
            }
            onChange={(nueva) =>
              setLista(
                (l) =>
                  l?.map((x) => (x.id === nueva.id ? { ...x, ...nueva } : x)) ??
                  null,
              )
            }
          />
        ))}
      </ul>
    </div>
  );
}
