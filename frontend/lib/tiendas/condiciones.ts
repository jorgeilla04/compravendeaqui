import { pesosLabel } from "@/lib/tiendas/cotizar";
import type { Tienda } from "@/lib/tiendas/types";

/** Resumen de cómo compra y recibe: lo arma la config del dueño. */
export function condiciones(tienda: Tienda): string[] {
  const items: string[] = [];
  if (tienda.entregas.includes("estandar")) {
    const monto = Number(tienda.envio_monto);
    items.push(
      monto === 0
        ? `Envío sin cargo en ${tienda.envio_demora}.`
        : `Envío a domicilio: ${pesosLabel(monto)}, en ${tienda.envio_demora}${
            tienda.envio_gratis_desde
              ? ` (gratis desde ${pesosLabel(tienda.envio_gratis_desde)})`
              : ""
          }.`,
    );
  }
  if (tienda.entregas.includes("express")) {
    items.push(`Express en ${tienda.express_demora}.`);
  }
  if (tienda.entregas.includes("retiro") && tienda.retiro_direccion) {
    items.push(`Retiro sin cargo en ${tienda.retiro_direccion}.`);
  }
  if (tienda.modalidades.includes("sena")) {
    items.push(
      `Pagás una seña del ${tienda.sena_pct}%${
        tienda.modalidades.includes("total") ? " (o el total)" : ""
      } y el resto cuando lo recibís.`,
    );
  } else {
    items.push("Pagás el total al hacer el pedido.");
  }
  return items;
}
