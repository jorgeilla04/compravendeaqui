"use client";

import * as React from "react";

import { useOptionalAuth } from "@/components/auth/auth-provider";
import { PublicarEnRedes } from "@/components/redes/publicar-en-redes";
import type { GrupoDetalle } from "@/lib/tiendas/types";

/**
 * "Publicar en redes" en la página de un colegio (solo administradores):
 * se elige la prenda y se publica con el precio y la foto de ese colegio.
 */
export function PublicarProductoEnRedes({
  tienda,
  grupo,
}: {
  tienda: string;
  grupo: GrupoDetalle;
}) {
  const esAdmin = useOptionalAuth()?.user?.role === "admin";
  const [producto, setProducto] = React.useState(
    grupo.productos[0]?.slug ?? "",
  );
  if (!esAdmin || !producto) return null;

  const path = `/admin/redes/tiendas/${encodeURIComponent(
    tienda,
  )}/grupos/${encodeURIComponent(grupo.slug)}/productos/${encodeURIComponent(
    producto,
  )}`;

  return (
    <PublicarEnRedes
      path={path}
      selector={
        <label className="flex flex-col gap-1 text-meta font-semibold sm:max-w-xs">
          Prenda
          <select
            value={producto}
            onChange={(e) => setProducto(e.target.value)}
            className="min-h-11 rounded-input border border-border bg-card px-3 text-base font-normal"
          >
            {grupo.productos.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
      }
    />
  );
}
