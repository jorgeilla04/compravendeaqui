"use client";

import * as React from "react";

import { KitRedes } from "@/components/redes/kit-redes";
import { PublicarEnRedes } from "@/components/redes/publicar-en-redes";

/**
 * Pestaña "Redes" de un colegio en el panel de la tienda: se elige la prenda y
 * aparece el kit para publicar en las redes propias de la tienda. El
 * administrador del sitio, además, publica en las redes de CompraVendeAqui.
 */
export function RedesDelColegio({
  tienda,
  grupo,
  productos,
  esAdminDelSitio,
}: {
  tienda: string;
  grupo: string;
  productos: { slug: string; nombre: string }[];
  esAdminDelSitio: boolean;
}) {
  const [producto, setProducto] = React.useState(productos[0]?.slug ?? "");
  if (!producto) return null;
  const seg = (s: string) => encodeURIComponent(s);
  const selector = (
    <label className="flex flex-col gap-1 text-meta font-semibold sm:max-w-xs">
      Prenda
      <select
        value={producto}
        onChange={(e) => setProducto(e.target.value)}
        className="min-h-11 rounded-input border border-border bg-card px-3 text-base font-normal"
      >
        {productos.map((p) => (
          <option key={p.slug} value={p.slug}>
            {p.nombre}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="flex flex-col gap-4">
      <KitRedes
        path={`/admin/tiendas/${seg(tienda)}/grupos/${seg(grupo)}/productos/${seg(producto)}/kit`}
        archivo={`${grupo}-${producto}`}
        selector={selector}
      />
      {esAdminDelSitio ? (
        <PublicarEnRedes
          path={`/admin/redes/tiendas/${seg(tienda)}/grupos/${seg(grupo)}/productos/${seg(producto)}`}
        />
      ) : null}
    </div>
  );
}
