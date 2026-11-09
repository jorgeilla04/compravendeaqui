import { serverGet } from "@/lib/api";
import type { Tienda } from "@/lib/tiendas/types";

/** La tienda para las páginas del servidor (null si no existe). */
export function getTienda(slug: string): Promise<Tienda | null> {
  return serverGet<Tienda>(
    `/tiendas/${encodeURIComponent(slug)}`,
    undefined,
    60,
  );
}
