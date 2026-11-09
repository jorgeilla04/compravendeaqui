"use client";

import { CheckCircle2, Clock, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError, errorMessage } from "@/lib/api";
import { cartStorageKey } from "@/lib/tiendas/cart";
import { pesosLabel } from "@/lib/tiendas/cotizar";
import { ESTADO_LABEL, type Pedido } from "@/lib/tiendas/types";

export const POLL_MS = 4000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND = "No encontramos ese pedido. Revisá el link.";
const MAX_POLLS = 15;

export function PedidoEstado({ id }: { id: string }) {
  const searchParams = useSearchParams();
  // Mercado Pago vuelve con payment_id (o collection_id en integraciones viejas).
  const paymentId =
    searchParams.get("payment_id") ?? searchParams.get("collection_id");
  const [pedido, setPedido] = React.useState<Pedido | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const polls = React.useRef(0);

  const load = React.useCallback(async () => {
    // El id viene de la URL: solo un UUID llega a la API (nada de "../").
    if (!UUID_RE.test(id)) {
      setError(NOT_FOUND);
      return;
    }
    try {
      setPedido(
        await api<Pedido>(`/tiendas/pedidos/${encodeURIComponent(id)}`, {
          noRefresh: true,
          query:
            paymentId && /^\d+$/.test(paymentId)
              ? { payment_id: paymentId }
              : undefined,
        }),
      );
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 404
          ? NOT_FOUND
          : errorMessage(err),
      );
    }
  }, [id, paymentId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Volvió de pagar y el aviso de Mercado Pago todavía no llegó: reintenta.
  React.useEffect(() => {
    if (pedido?.estado !== "pendiente_pago" || !paymentId) return;
    if (polls.current >= MAX_POLLS) return;
    const timer = window.setTimeout(() => {
      polls.current += 1;
      void load();
    }, POLL_MS);
    return () => window.clearTimeout(timer);
  }, [pedido, paymentId, load]);

  // El pedido ya está en manos del dueño de la tienda: se vacía ese carrito.
  React.useEffect(() => {
    if (pedido && ["pagado", "a_coordinar"].includes(pedido.estado)) {
      try {
        window.localStorage.setItem(cartStorageKey(pedido.tienda.slug), "[]");
      } catch {
        /* sin storage: no hay carrito guardado */
      }
    }
  }, [pedido]);

  if (error) return <FormMessage>{error}</FormMessage>;
  if (!pedido) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <span className="sr-only">Cargando el pedido…</span>
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const head = {
    pagado: {
      icon: CheckCircle2,
      tone: "text-accent",
      title: "¡Listo! Recibimos tu pago",
      text:
        pedido.modalidad_pago === "sena"
          ? `Pagaste la seña de ${pesosLabel(pedido.pagado_ahora)}. El resto, ${pesosLabel(pedido.saldo)}, lo pagás en la entrega.`
          : `Pagaste ${pesosLabel(pedido.pagado_ahora)}. No tenés que pagar nada en la entrega.`,
    },
    a_coordinar: {
      icon: CheckCircle2,
      tone: "text-accent",
      title: "Recibimos tu pedido",
      text: `Te vamos a escribir por WhatsApp para coordinar el pago de ${pesosLabel(pedido.pagado_ahora)} y la entrega.`,
    },
    pendiente_pago: {
      icon: Clock,
      tone: "text-primary",
      title: paymentId
        ? "Estamos confirmando tu pago"
        : "Tu pedido está esperando el pago",
      text: paymentId
        ? "Mercado Pago nos avisa en unos segundos. No hace falta que pagues de nuevo."
        : `Para confirmarlo, pagá ${pesosLabel(pedido.pagado_ahora)} con Mercado Pago.`,
    },
    rechazado: {
      icon: XCircle,
      tone: "text-destructive",
      title: "El pago no se aprobó",
      text: "No se cobró nada. Podés probar de nuevo con otro medio de pago.",
    },
  }[
    pedido.estado as "pagado" | "a_coordinar" | "pendiente_pago" | "rechazado"
  ] ?? {
    icon: CheckCircle2,
    tone: "text-primary",
    title: ESTADO_LABEL[pedido.estado],
    text: "",
  };
  const Icon = head.icon;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex items-start gap-3">
        <Icon
          aria-hidden="true"
          className={`mt-1 size-8 shrink-0 ${head.tone}`}
        />
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-h1 font-semibold">{head.title}</h1>
          <p className="text-muted-foreground" aria-live="polite">
            {head.text}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        {pedido.pago_url ? (
          <Button asChild variant="accent" size="lg">
            <a href={pedido.pago_url}>
              {pedido.estado === "rechazado" ? "Probar de nuevo" : "Ir a pagar"}
            </a>
          </Button>
        ) : null}
        <Button asChild variant="whatsapp" size="lg">
          <a
            href={pedido.whatsapp_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Escribir por WhatsApp
          </a>
        </Button>
      </div>

      <section
        aria-labelledby="detalle-title"
        className="flex flex-col gap-3 rounded-card border border-border bg-card p-4"
      >
        <h2 id="detalle-title" className="font-heading text-h2 font-semibold">
          Pedido {pedido.codigo}
        </h2>
        <p className="text-meta text-muted-foreground">
          {pedido.tienda.nombre} · {ESTADO_LABEL[pedido.estado]} ·{" "}
          {pedido.entrega_label}
        </p>
        <ul className="flex flex-col gap-1">
          {pedido.items.map((item, i) => (
            <li key={i} className="flex justify-between gap-4">
              <span>
                {item.cantidad} × {item.producto_nombre}
                {item.opcion
                  ? ` ${pedido.opcion_label.toLowerCase()} ${item.opcion}`
                  : ""}
                <span className="block text-meta text-muted-foreground">
                  {item.grupo_nombre}
                </span>
              </span>
              <span>
                {pesosLabel(Number(item.precio_unit) * item.cantidad)}
              </span>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-1 border-t border-border pt-3">
          <div className="flex justify-between">
            <dt>Total</dt>
            <dd className="font-semibold">{pesosLabel(pedido.total)}</dd>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <dt>{pedido.estado === "pagado" ? "Pagado" : "A pagar ahora"}</dt>
            <dd>{pesosLabel(pedido.pagado_ahora)}</dd>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <dt>Saldo contra entrega</dt>
            <dd>{pesosLabel(pedido.saldo)}</dd>
          </div>
        </dl>
      </section>
      <Link
        href={`/tiendas/${pedido.tienda.slug}`}
        className="self-start font-semibold text-primary underline underline-offset-4"
      >
        Volver a la tienda
      </Link>
    </div>
  );
}
