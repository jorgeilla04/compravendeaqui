"use client";

import * as React from "react";

import { useOptionalAuth } from "@/components/auth/auth-provider";
import { PublicarEnRedes } from "@/components/redes/publicar-en-redes";

export function esAdminDelSitio(rol: string | undefined) {
  return rol === "admin";
}

/**
 * "Publicar en redes" de las prendas de un colegio (solo administradores del
 * sitio): se elige la prenda y se publica con el precio y la foto de ese
 * colegio. Está en la página del colegio y en el panel de la tienda.
 */
export function PublicarProductoEnRedes({
  tienda,
  grupo,
}: {
  tienda: string;
  grupo: { slug: string; productos: { slug: string; nombre: string }[] };
}) {
  const esAdmin = esAdminDelSitio(useOptionalAuth()?.user?.role);
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
