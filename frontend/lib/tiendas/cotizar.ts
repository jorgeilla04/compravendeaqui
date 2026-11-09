import type { Entrega, ModalidadPago, TiendaReglas } from "./types";

export interface Totales {
  subtotal: number;
  envioMonto: number;
  recargoExpress: number;
  total: number;
  pagadoAhora: number;
  saldo: number;
}

/** Redondeo a pesos "half up", igual que el backend (Decimal ROUND_HALF_UP). */
function pesos(value: number): number {
  return Math.floor(value + 0.5);
}

/**
 * Totales para mostrar en el carrito. Espejo de `cotizar()` del backend con
 * la config de la tienda: el monto que se cobra lo calcula el servidor.
 */
export function cotizar(
  subtotal: number,
  entrega: Entrega,
  modalidad: ModalidadPago,
  reglas: Pick<
    TiendaReglas,
    | "envio_monto"
    | "envio_gratis_desde"
    | "express_recargo_pct"
    | "express_monto"
    | "sena_pct"
  >,
): Totales {
  const sub = pesos(subtotal);
  let envioMonto = 0;
  let recargoExpress = 0;
  if (entrega !== "retiro") {
    const gratisDesde = reglas.envio_gratis_desde;
    const gratis = gratisDesde !== null && sub >= Number(gratisDesde);
    envioMonto = gratis ? 0 : pesos(Number(reglas.envio_monto));
  }
  if (entrega === "express") {
    recargoExpress =
      pesos((sub * reglas.express_recargo_pct) / 100) +
      pesos(Number(reglas.express_monto));
  }
  const total = sub + envioMonto + recargoExpress;
  const pagadoAhora =
    modalidad === "sena"
      ? pesos((sub * reglas.sena_pct) / 100) + envioMonto + recargoExpress
      : total;
  return {
    subtotal: sub,
    envioMonto,
    recargoExpress,
    total,
    pagadoAhora,
    saldo: total - pagadoAhora,
  };
}

const number = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

export function pesosLabel(value: number | string): string {
  return `$ ${number.format(typeof value === "string" ? Number(value) : value)}`;
}
