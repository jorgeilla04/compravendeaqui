import type { Envio, ModalidadPago, TiendaConfig } from "./types";

export interface Totales {
  subtotal: number;
  recargoExpress: number;
  envioMonto: number;
  total: number;
  pagadoAhora: number;
  saldo: number;
}

/** Redondeo a pesos "half up", igual que el backend (Decimal ROUND_HALF_UP). */
function pesos(value: number): number {
  return Math.floor(value + 0.5);
}

/**
 * Totales para mostrar en el carrito. Espejo de `cotizar()` del backend: el
 * monto que se cobra lo calcula siempre el servidor.
 */
export function cotizar(
  subtotal: number,
  envio: Envio,
  modalidad: ModalidadPago,
  config: Pick<
    TiendaConfig,
    "envio_monto" | "express_recargo_pct" | "sena_pct"
  >,
): Totales {
  const sub = pesos(subtotal);
  const recargoExpress =
    envio === "express" ? pesos((sub * config.express_recargo_pct) / 100) : 0;
  const envioMonto = pesos(config.envio_monto);
  const total = sub + recargoExpress + envioMonto;
  const pagadoAhora =
    modalidad === "sena"
      ? pesos((sub * config.sena_pct) / 100) + envioMonto + recargoExpress
      : total;
  return {
    subtotal: sub,
    recargoExpress,
    envioMonto,
    total,
    pagadoAhora,
    saldo: total - pagadoAhora,
  };
}

const number = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

export function pesosLabel(value: number | string): string {
  return `$ ${number.format(typeof value === "string" ? Number(value) : value)}`;
}
