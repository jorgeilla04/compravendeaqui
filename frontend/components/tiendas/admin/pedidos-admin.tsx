"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormMessage, SelectField } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { pesosLabel } from "@/lib/uniformes/cotizar";
import {
  ESTADO_LABEL,
  type EstadoPedido,
  type PedidoAdmin,
} from "@/lib/uniformes/types";

const ESTADOS = Object.keys(ESTADO_LABEL) as EstadoPedido[];

function PedidoRow({
  pedido,
  onChange,
}: {
  pedido: PedidoAdmin;
  onChange: (p: PedidoAdmin) => void;
}) {
  const [estado, setEstado] = React.useState<EstadoPedido>(pedido.estado);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      onChange(
        await api<PedidoAdmin>(`/admin/uniformes/pedidos/${pedido.id}`, {
          method: "PUT",
          body: { estado },
        }),
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-heading text-h3 font-semibold">
          {pedido.codigo} · {pedido.cliente_nombre}
        </h3>
        <Badge tone={pedido.estado === "pagado" ? "success" : "neutral"}>
          {ESTADO_LABEL[pedido.estado]}
        </Badge>
      </div>
      <p className="text-meta text-muted-foreground">
        {formatDate(pedido.created_at)} ·{" "}
        {pedido.envio === "express" ? "Express 24 hs" : "Estándar 48 hs"} ·{" "}
        {pedido.modalidad_pago === "sena" ? "Seña" : "Pago total"}
        {pedido.mp_payment_id ? ` · MP N° ${pedido.mp_payment_id}` : ""}
      </p>
      <ul className="text-base">
        {pedido.items.map((item, i) => (
          <li key={i}>
            {item.cantidad} × {item.prenda_nombre} talle {item.talle} —{" "}
            {item.colegio_nombre}
          </li>
        ))}
      </ul>
      <dl className="grid gap-1 text-base sm:grid-cols-2">
        <div>
          <dt className="inline font-semibold">Entrega: </dt>
          <dd className="inline">
            {pedido.direccion}, {pedido.departamento}
          </dd>
        </div>
        <div>
          <dt className="inline font-semibold">Teléfono: </dt>
          <dd className="inline">{pedido.cliente_tel}</dd>
        </div>
        {pedido.cliente_email ? (
          <div>
            <dt className="inline font-semibold">Email: </dt>
            <dd className="inline">{pedido.cliente_email}</dd>
          </div>
        ) : null}
        {pedido.notas ? (
          <div className="sm:col-span-2">
            <dt className="inline font-semibold">Notas: </dt>
            <dd className="inline">{pedido.notas}</dd>
          </div>
        ) : null}
        <div>
          <dt className="inline font-semibold">Total: </dt>
          <dd className="inline">{pesosLabel(pedido.total)}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">Ahora / saldo: </dt>
          <dd className="inline">
            {pesosLabel(pedido.pagado_ahora)} / {pesosLabel(pedido.saldo)}
          </dd>
        </div>
      </dl>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <SelectField
          id={`estado-${pedido.id}`}
          label="Cambiar estado"
          value={estado}
          onChange={(e) => setEstado(e.target.value as EstadoPedido)}
          disabled={saving}
        >
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {ESTADO_LABEL[e]}
            </option>
          ))}
        </SelectField>
        <Button
          type="button"
          variant="primary"
          onClick={save}
          disabled={saving || estado === pedido.estado}
        >
          Guardar estado
        </Button>
        <Button asChild variant="whatsapp">
          <a
            href={pedido.cliente_whatsapp_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp al cliente
          </a>
        </Button>
      </div>
      {error ? <FormMessage>{error}</FormMessage> : null}
    </li>
  );
}

export function PedidosAdmin() {
  const [filtro, setFiltro] = React.useState<EstadoPedido | "">("");
  const [pedidos, setPedidos] = React.useState<PedidoAdmin[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPedidos(null);
    api<PedidoAdmin[]>(
      `/admin/uniformes/pedidos${filtro ? `?estado=${filtro}` : ""}`,
    )
      .then(setPedidos)
      .catch((err) => setError(errorMessage(err)));
  }, [filtro]);

  return (
    <div className="flex flex-col gap-4">
      <SelectField
        id="filtro-estado"
        label="Mostrar"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value as EstadoPedido | "")}
        className="sm:max-w-xs"
      >
        <option value="">Todos los pedidos</option>
        {ESTADOS.map((e) => (
          <option key={e} value={e}>
            {ESTADO_LABEL[e]}
          </option>
        ))}
      </SelectField>
      {error ? <FormMessage>{error}</FormMessage> : null}
      {pedidos === null && !error ? (
        <Skeleton className="h-40 w-full" />
      ) : pedidos?.length === 0 ? (
        <p className="text-muted-foreground">No hay pedidos.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pedidos?.map((p) => (
            <PedidoRow
              key={p.id}
              pedido={p}
              onChange={(updated) =>
                setPedidos(
                  (list) =>
                    list?.map((x) => (x.id === updated.id ? updated : x)) ??
                    null,
                )
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}
