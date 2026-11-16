import type { Producto } from "@/lib/tiendas/types";

/**
 * Precio de un producto para un talle: el de su tramo si tiene (null =
 * consultar), si no el precio del producto en el grupo. El servidor cobra
 * siempre con la misma regla.
 */
export function precioDe(
  producto: Pick<Producto, "precio" | "precios_talle">,
  opcion: string | null,
): string | null {
  const propios = producto.precios_talle ?? {};
  if (opcion !== null && opcion in propios) return propios[opcion];
  return producto.precio;
}
