"use client";

import { CheckCircle2, Clock, CreditCard, Mail, XCircle } from "lucide-react";
import * as React from "react";

import { entregaTextos } from "@/components/tiendas/checkout";
import { Button } from "@/components/ui/button";
import { cotizar, pesosLabel } from "@/lib/tiendas/cotizar";
import type { Entrega, ModalidadPago, Tienda } from "@/lib/tiendas/types";
import { cn } from "@/lib/utils";

/**
 * Demo del cobro con Mercado Pago para mostrarle el flujo a quien vende antes
 * de tener las credenciales. No crea pedidos ni cobra: todo pasa en esta
 * pantalla, con la configuración real de la tienda.
 */

const ITEMS = [
  {
    nombre: "Remera / chomba",
    detalle: "Colegio San Pablo · talle 10",
    precio: 10000,
  },
  { nombre: "Pollera", detalle: "Colegio San Pablo · talle 10", precio: 10000 },
];

type Paso = "carrito" | "mercadopago" | "resultado";
type Resultado = "aprobado" | "pendiente" | "rechazado";

const radio =
  "flex min-h-14 cursor-pointer items-start gap-3 rounded-input border border-border bg-card p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5";

export function DemoPago({ tienda }: { tienda: Tienda }) {
  const [paso, setPaso] = React.useState<Paso>("carrito");
  const [entrega, setEntrega] = React.useState<Entrega>(
    tienda.entregas[0] ?? "estandar",
  );
  const [modalidad, setModalidad] = React.useState<ModalidadPago>(
    tienda.modalidades.includes("sena") ? "sena" : "total",
  );
  const [resultado, setResultado] = React.useState<Resultado>("aprobado");
  const subtotal = ITEMS.reduce((s, i) => s + i.precio, 0);
  const t = cotizar(subtotal, entrega, modalidad, tienda);
  const titulo = React.useRef<HTMLHeadingElement>(null);

  function ir(p: Paso) {
    setPaso(p);
    requestAnimationFrame(() => titulo.current?.focus());
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-4">
      <p
        role="note"
        className="rounded-card border border-amber-500/40 bg-amber-500/10 p-3 text-base"
      >
        <strong>Demo:</strong> así funciona el cobro con Mercado Pago. No se
        cobra nada ni se crea ningún pedido. Los montos usan la configuración
        real de {tienda.nombre}.
      </p>
      <ol
        aria-label="Pasos"
        className="flex flex-wrap gap-2 text-meta text-muted-foreground"
      >
        {(
          [
            ["carrito", "1. Carrito"],
            ["mercadopago", "2. Pago en Mercado Pago"],
            ["resultado", "3. Resultado"],
          ] as const
        ).map(([id, label]) => (
          <li
            key={id}
            aria-current={paso === id ? "step" : undefined}
            className={cn(
              "rounded-pill border px-3 py-1",
              paso === id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border",
            )}
          >
            {label}
          </li>
        ))}
      </ol>

      {paso === "carrito" ? (
        <section className="flex flex-col gap-5" aria-labelledby="demo-titulo">
          <h1
            id="demo-titulo"
            ref={titulo}
            tabIndex={-1}
            className="font-heading text-h1 font-semibold focus:outline-none"
          >
            El cliente arma su pedido
          </h1>
          <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-card">
            {ITEMS.map((i) => (
              <li key={i.nombre} className="flex justify-between gap-3 p-3">
                <span>
                  <span className="font-semibold">{i.nombre}</span>
                  <span className="block text-meta text-muted-foreground">
                    {i.detalle}
                  </span>
                </span>
                <span className="font-semibold">{pesosLabel(i.precio)}</span>
              </li>
            ))}
          </ul>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-semibold">Entrega</legend>
            {tienda.entregas.map((e) => {
              const txt = entregaTextos(tienda, e, subtotal);
              return (
                <label key={e} className={radio}>
                  <input
                    type="radio"
                    name="entrega"
                    value={e}
                    checked={entrega === e}
                    onChange={() => setEntrega(e)}
                    className="mt-1 size-5 accent-[var(--color-primary)]"
                  />
                  <span>
                    <span className="font-semibold">{txt.title}</span>
                    {txt.detail ? (
                      <span className="block text-meta text-muted-foreground">
                        {txt.detail}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </fieldset>

          {tienda.modalidades.length > 1 ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 font-semibold">Cómo paga</legend>
              {tienda.modalidades.map((m) => (
                <label key={m} className={radio}>
                  <input
                    type="radio"
                    name="modalidad"
                    value={m}
                    checked={modalidad === m}
                    onChange={() => setModalidad(m)}
                    className="mt-1 size-5 accent-[var(--color-primary)]"
                  />
                  <span className="font-semibold">
                    {m === "sena"
                      ? `Seña del ${tienda.sena_pct}% (más el envío) y el resto al recibir`
                      : "Todo ahora"}
                  </span>
                </label>
              ))}
            </fieldset>
          ) : null}

          <Resumen t={t} modalidad={modalidad} />
          <Button
            type="button"
            variant="accent"
            size="lg"
            className="w-full"
            onClick={() => ir("mercadopago")}
          >
            Pagar {pesosLabel(t.pagadoAhora)} con Mercado Pago
          </Button>
        </section>
      ) : null}

      {paso === "mercadopago" ? (
        <section className="flex flex-col gap-5" aria-labelledby="demo-titulo">
          <h1
            id="demo-titulo"
            ref={titulo}
            tabIndex={-1}
            className="font-heading text-h1 font-semibold focus:outline-none"
          >
            El cliente paga en Mercado Pago
          </h1>
          <p className="text-muted-foreground">
            El botón lo lleva a la página segura de Mercado Pago (fuera de
            CompraVendeAqui) con el monto ya cargado. Ahí elige cómo pagar:
          </p>
          <div className="flex flex-col gap-3 rounded-card border-2 border-dashed border-border bg-card p-5">
            <p className="text-meta uppercase tracking-wide text-muted-foreground">
              Pantalla de Mercado Pago (ilustración)
            </p>
            <p className="text-h2 font-semibold">{pesosLabel(t.pagadoAhora)}</p>
            <p className="text-meta text-muted-foreground">
              {tienda.nombre} · pedido de ejemplo
            </p>
            <ul className="flex flex-col gap-2 text-base">
              <li className="flex items-center gap-2">
                <CreditCard aria-hidden="true" className="size-5" />
                Tarjeta de crédito (con cuotas) o débito
              </li>
              <li className="flex items-center gap-2">
                <CreditCard aria-hidden="true" className="size-5" />
                Dinero disponible en Mercado Pago
              </li>
              <li className="flex items-center gap-2">
                <Clock aria-hidden="true" className="size-5" />
                Efectivo en Pago Fácil o Rapipago (queda pendiente hasta que
                paga)
              </li>
            </ul>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-semibold">
              Simulá qué pasa con el pago
            </legend>
            {(
              [
                ["aprobado", "Se aprueba (tarjeta o dinero en cuenta)"],
                ["pendiente", "Queda pendiente (eligió efectivo)"],
                ["rechazado", "Se rechaza (tarjeta sin fondos)"],
              ] as const
            ).map(([v, l]) => (
              <label key={v} className={radio}>
                <input
                  type="radio"
                  name="resultado"
                  value={v}
                  checked={resultado === v}
                  onChange={() => setResultado(v)}
                  className="mt-1 size-5 accent-[var(--color-primary)]"
                />
                <span className="font-semibold">{l}</span>
              </label>
            ))}
          </fieldset>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="ghost" onClick={() => ir("carrito")}>
              Volver al carrito
            </Button>
            <Button
              type="button"
              variant="primary"
              className="sm:flex-1"
              onClick={() => ir("resultado")}
            >
              Ver qué pasa después
            </Button>
          </div>
        </section>
      ) : null}

      {paso === "resultado" ? (
        <section className="flex flex-col gap-5" aria-labelledby="demo-titulo">
          <h1
            id="demo-titulo"
            ref={titulo}
            tabIndex={-1}
            className="font-heading text-h1 font-semibold focus:outline-none"
          >
            {resultado === "aprobado"
              ? "Pago aprobado"
              : resultado === "pendiente"
                ? "Pago pendiente"
                : "Pago rechazado"}
          </h1>
          <div className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
            <h2 className="flex items-center gap-2 font-semibold">
              {resultado === "aprobado" ? (
                <CheckCircle2
                  aria-hidden="true"
                  className="size-5 text-accent"
                />
              ) : resultado === "pendiente" ? (
                <Clock aria-hidden="true" className="size-5" />
              ) : (
                <XCircle
                  aria-hidden="true"
                  className="size-5 text-destructive"
                />
              )}
              Lo que ve el cliente
            </h2>
            <p>
              {resultado === "aprobado"
                ? `Vuelve a CompraVendeAqui y ve su pedido como pagado: ${pesosLabel(t.pagadoAhora)}.`
                : resultado === "pendiente"
                  ? "Vuelve al sitio y ve el pedido esperando el pago. Se confirma solo cuando paga en efectivo."
                  : "Vuelve al sitio, ve que el pago no pasó y puede intentar de nuevo con otro medio."}
            </p>
            {resultado === "aprobado" && t.saldo > 0 ? (
              <p className="text-muted-foreground">
                Le queda pagar {pesosLabel(t.saldo)} cuando recibe el pedido.
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
            <h2 className="flex items-center gap-2 font-semibold">
              <Mail aria-hidden="true" className="size-5" />
              Lo que recibe {tienda.vendedor_nombre}
            </h2>
            {resultado === "aprobado" ? (
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  La plata entra en su cuenta de Mercado Pago (menos la comisión
                  de Mercado Pago).
                </li>
                <li>
                  Le llega un mail con el pedido: qué prendas, talles, colegio,
                  datos del cliente y la entrega.
                </li>
                <li>
                  En el panel, el pedido aparece como pagado para prepararlo
                  {t.saldo > 0
                    ? ` y cobrar ${pesosLabel(t.saldo)} al entregar`
                    : ""}
                  .
                </li>
              </ul>
            ) : resultado === "pendiente" ? (
              <p>
                El pedido figura en el panel como pendiente de pago. No hay que
                prepararlo hasta que se confirme: el sitio lo marca solo cuando
                Mercado Pago avisa.
              </p>
            ) : (
              <p>
                No recibe nada para preparar: el pedido queda sin pagar y no
                entra plata.
              </p>
            )}
          </div>
          <Resumen t={t} modalidad={modalidad} />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setResultado("aprobado");
              ir("carrito");
            }}
          >
            Empezar de nuevo
          </Button>
        </section>
      ) : null}
    </div>
  );
}

function Resumen({
  t,
  modalidad,
}: {
  t: ReturnType<typeof cotizar>;
  modalidad: ModalidadPago;
}) {
  const filas: [string, number][] = [["Productos", t.subtotal]];
  if (t.envioMonto) filas.push(["Envío", t.envioMonto]);
  if (t.recargoExpress) filas.push(["Recargo express", t.recargoExpress]);
  return (
    <dl className="flex flex-col gap-1 rounded-card border border-border bg-card p-4">
      {filas.map(([k, v]) => (
        <div key={k} className="flex justify-between">
          <dt>{k}</dt>
          <dd>{pesosLabel(v)}</dd>
        </div>
      ))}
      <div className="flex justify-between border-t border-border pt-2 font-semibold">
        <dt>Total</dt>
        <dd>{pesosLabel(t.total)}</dd>
      </div>
      <div className="flex justify-between font-semibold text-primary">
        <dt>
          {modalidad === "sena" ? "Paga ahora (seña + envío)" : "Paga ahora"}
        </dt>
        <dd>{pesosLabel(t.pagadoAhora)}</dd>
      </div>
      {t.saldo > 0 ? (
        <div className="flex justify-between text-muted-foreground">
          <dt>Paga al recibir</dt>
          <dd>{pesosLabel(t.saldo)}</dd>
        </div>
      ) : null}
    </dl>
  );
}
