"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { PrendaIlustracion } from "@/components/uniformes/prenda-ilustracion";
import { Button } from "@/components/ui/button";
import {
  FormMessage,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { itemKey, MAX_CANTIDAD, useCart } from "@/lib/uniformes/cart";
import { cotizar, pesosLabel } from "@/lib/uniformes/cotizar";
import type {
  Envio,
  ModalidadPago,
  PedidoCreado,
  TiendaConfig,
} from "@/lib/uniformes/types";

export interface DatosCliente {
  nombre: string;
  telefono: string;
  email: string;
  direccion: string;
  departamento: string;
  notas: string;
}

type Errors = Partial<Record<keyof DatosCliente, string>>;

export function validateCliente(datos: DatosCliente): Errors {
  const errors: Errors = {};
  if (datos.nombre.trim().length < 2)
    errors.nombre = "Escribí tu nombre y apellido.";
  if (datos.telefono.replace(/\D/g, "").length < 10) {
    errors.telefono =
      "Ingresá tu celular con característica, por ejemplo 264 412-3456.";
  }
  if (
    datos.email.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email.trim())
  ) {
    errors.email = "Revisá el email, parece que le falta algo.";
  }
  if (datos.direccion.trim().length < 5) {
    errors.direccion = "Escribí la calle, el número y alguna referencia.";
  }
  if (!datos.departamento) errors.departamento = "Elegí el departamento.";
  return errors;
}

const stepper =
  "inline-flex size-10 items-center justify-center rounded-input border border-border bg-card text-foreground transition-colors duration-200 hover:border-primary disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Option({
  name,
  value,
  checked,
  onChange,
  title,
  detail,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  detail: string;
}) {
  return (
    <label
      className={cn(
        "flex min-h-14 cursor-pointer items-start gap-3 rounded-input border bg-card p-3 transition-colors duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
        checked
          ? "bg-primary/5 border-primary"
          : "border-border hover:border-primary",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-1 size-5 shrink-0 accent-[var(--color-primary)] focus-visible:outline-none"
      />
      <span className="flex flex-col">
        <span className="font-semibold text-foreground">{title}</span>
        <span className="text-meta text-muted-foreground">{detail}</span>
      </span>
    </label>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-4",
        strong && "font-semibold text-foreground",
      )}
    >
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function Checkout({ config }: { config: TiendaConfig }) {
  const { items, ready, subtotal, setCantidad, remove } = useCart();
  const router = useRouter();
  const [envio, setEnvio] = React.useState<Envio>("estandar");
  const [modalidad, setModalidad] = React.useState<ModalidadPago>("sena");
  const [datos, setDatos] = React.useState<DatosCliente>({
    nombre: "",
    telefono: "",
    email: "",
    direccion: "",
    departamento: "",
    notas: "",
  });
  const [errors, setErrors] = React.useState<Errors>({});
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const t = cotizar(subtotal, envio, modalidad, config);

  function set<K extends keyof DatosCliente>(key: K, value: string) {
    setDatos((d) => ({ ...d, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validateCliente(datos);
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) {
      document.getElementById(`cliente-${Object.keys(found)[0]}`)?.focus();
      return;
    }
    setSending(true);
    try {
      const res = await api<PedidoCreado>("/uniformes/pedidos", {
        method: "POST",
        noRefresh: true,
        body: {
          items: items.map((i) => ({
            colegio: i.colegio,
            prenda: i.prenda,
            talle: i.talle,
            cantidad: i.cantidad,
          })),
          envio,
          modalidad_pago: modalidad,
          cliente: {
            nombre: datos.nombre.trim(),
            telefono: datos.telefono.trim(),
            email: datos.email.trim() || null,
            direccion: datos.direccion.trim(),
            departamento: datos.departamento,
            notas: datos.notas.trim() || null,
          },
        },
      });
      if (res.init_point) {
        window.location.assign(res.init_point);
      } else {
        router.push(`/uniformes/pedido/${res.pedido.id}`);
      }
    } catch (err) {
      setServerError(errorMessage(err));
      setSending(false);
    }
  }

  if (!ready) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <span className="sr-only">Cargando el carrito…</span>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex max-w-prose flex-col items-start gap-4">
        <h1 className="font-heading text-h1 font-semibold">
          Tu carrito está vacío
        </h1>
        <p className="text-muted-foreground">
          Elegí tu colegio y sumá las prendas que necesitás.
        </p>
        <Button asChild variant="primary" size="lg">
          <Link href="/uniformes">Elegir colegio</Link>
        </Button>
      </div>
    );
  }

  const payLabel = config.pagos_online
    ? `Pagar ${pesosLabel(t.pagadoAhora)} con Mercado Pago`
    : `Enviar pedido a ${config.vendedora_nombre.split(" ")[0]}`;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start"
    >
      <div className="flex flex-col gap-8">
        <h1 className="font-heading text-h1 font-semibold">Tu pedido</h1>

        <section aria-labelledby="items-title" className="flex flex-col gap-3">
          <h2 id="items-title" className="sr-only">
            Prendas
          </h2>
          <ul className="flex flex-col gap-3">
            {items.map((item) => {
              const key = itemKey(item);
              const name = `${item.prendaNombre} talle ${item.talle}`;
              return (
                <li
                  key={key}
                  className="flex gap-3 rounded-card border border-border bg-card p-3"
                >
                  <PrendaIlustracion
                    tipo={item.tipo}
                    color1={item.color1}
                    color2={item.color2}
                    className="size-16 shrink-0 rounded-input bg-muted p-1"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="font-semibold text-foreground">{name}</p>
                      <p className="font-semibold">
                        {pesosLabel(item.precio * item.cantidad)}
                      </p>
                    </div>
                    <p className="text-meta text-muted-foreground">
                      {item.colegioNombre} · {pesosLabel(item.precio)} c/u
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className={stepper}
                        onClick={() => setCantidad(key, item.cantidad - 1)}
                        disabled={item.cantidad <= 1}
                        aria-label={`Una menos de ${name}`}
                      >
                        <Minus aria-hidden="true" className="size-4" />
                      </button>
                      <output
                        aria-label={`Cantidad de ${name}`}
                        className="min-w-6 text-center font-semibold"
                      >
                        {item.cantidad}
                      </output>
                      <button
                        type="button"
                        className={stepper}
                        onClick={() => setCantidad(key, item.cantidad + 1)}
                        disabled={item.cantidad >= MAX_CANTIDAD}
                        aria-label={`Una más de ${name}`}
                      >
                        <Plus aria-hidden="true" className="size-4" />
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="ml-auto text-destructive hover:text-destructive"
                        onClick={() => remove(key)}
                        aria-label={`Quitar ${name}`}
                      >
                        <Trash2 aria-hidden="true" />
                        Quitar
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <Link
            href="/uniformes"
            className="self-start font-semibold text-primary underline underline-offset-4"
          >
            Sumar prendas de otro colegio
          </Link>
        </section>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 font-heading text-h2 font-semibold">
            Envío
          </legend>
          <Option
            name="envio"
            value="estandar"
            checked={envio === "estandar"}
            onChange={() => setEnvio("estandar")}
            title={`Estándar · ${pesosLabel(config.envio_monto)}`}
            detail="Llega en 48 hs al Gran San Juan."
          />
          <Option
            name="envio"
            value="express"
            checked={envio === "express"}
            onChange={() => setEnvio("express")}
            title={`Express 24 hs · ${pesosLabel(config.envio_monto)} + ${config.express_recargo_pct}%`}
            detail={`Recargo del ${config.express_recargo_pct}% sobre el valor de los uniformes.`}
          />
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 font-heading text-h2 font-semibold">
            Pago
          </legend>
          <Option
            name="pago"
            value="sena"
            checked={modalidad === "sena"}
            onChange={() => setModalidad("sena")}
            title={`Seña · ${pesosLabel(cotizar(subtotal, envio, "sena", config).pagadoAhora)} ahora`}
            detail={`El ${config.sena_pct}% de los uniformes más el envío. El resto lo pagás cuando lo recibís.`}
          />
          <Option
            name="pago"
            value="total"
            checked={modalidad === "total"}
            onChange={() => setModalidad("total")}
            title={`Total · ${pesosLabel(cotizar(subtotal, envio, "total", config).pagadoAhora)}`}
            detail="Pagás todo ahora y no tenés que pagar nada en la entrega."
          />
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 font-heading text-h2 font-semibold">
            ¿A quién se lo llevamos?
          </legend>
          <TextField
            id="cliente-nombre"
            label="Nombre y apellido"
            autoComplete="name"
            value={datos.nombre}
            onChange={(e) => set("nombre", e.target.value)}
            error={errors.nombre}
            disabled={sending}
            required
          />
          <TextField
            id="cliente-telefono"
            label="Celular (WhatsApp)"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="264 412-3456"
            hint={`${config.vendedora_nombre} te escribe para coordinar la entrega.`}
            value={datos.telefono}
            onChange={(e) => set("telefono", e.target.value)}
            error={errors.telefono}
            disabled={sending}
            required
          />
          <TextField
            id="cliente-email"
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            optional
            hint="Para mandarte el comprobante."
            value={datos.email}
            onChange={(e) => set("email", e.target.value)}
            error={errors.email}
            disabled={sending}
          />
          <TextField
            id="cliente-direccion"
            label="Dirección de entrega"
            autoComplete="street-address"
            placeholder="Calle, número, barrio"
            value={datos.direccion}
            onChange={(e) => set("direccion", e.target.value)}
            error={errors.direccion}
            disabled={sending}
            required
          />
          <SelectField
            id="cliente-departamento"
            label="Departamento"
            value={datos.departamento}
            onChange={(e) => set("departamento", e.target.value)}
            error={errors.departamento}
            hint="Enviamos al Gran San Juan."
            disabled={sending}
            required
          >
            <option value="">Elegí el departamento</option>
            {config.departamentos_envio.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </SelectField>
          <p className="text-meta text-muted-foreground">
            ¿Estás en otro departamento?{" "}
            <a
              href={config.vendedora_whatsapp_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary underline underline-offset-4"
            >
              Consultá por WhatsApp
            </a>
            .
          </p>
          <TextAreaField
            id="cliente-notas"
            label="Indicaciones para la entrega"
            optional
            rows={3}
            maxLength={500}
            value={datos.notas}
            onChange={(e) => set("notas", e.target.value)}
            disabled={sending}
          />
        </fieldset>
      </div>

      <aside
        aria-labelledby="resumen-title"
        className="flex flex-col gap-4 rounded-card border border-border bg-card p-4 lg:sticky lg:top-24"
      >
        <h2 id="resumen-title" className="font-heading text-h2 font-semibold">
          Resumen
        </h2>
        <dl className="flex flex-col gap-2 text-base text-muted-foreground">
          <Row label="Uniformes" value={pesosLabel(t.subtotal)} />
          {t.recargoExpress > 0 ? (
            <Row
              label={`Express (+${config.express_recargo_pct}%)`}
              value={pesosLabel(t.recargoExpress)}
            />
          ) : null}
          <Row label="Envío" value={pesosLabel(t.envioMonto)} />
          <Row label="Total" value={pesosLabel(t.total)} strong />
          <div className="my-1 border-t border-border" />
          <Row label="Pagás ahora" value={pesosLabel(t.pagadoAhora)} strong />
          <Row label="Pagás al recibirlo" value={pesosLabel(t.saldo)} />
        </dl>
        {serverError ? <FormMessage>{serverError}</FormMessage> : null}
        <Button
          type="submit"
          variant="accent"
          size="lg"
          className="w-full"
          disabled={sending}
        >
          {sending
            ? config.pagos_online
              ? "Yendo a Mercado Pago…"
              : "Enviando…"
            : payLabel}
        </Button>
        <p className="text-meta text-muted-foreground">
          {config.pagos_online
            ? "Pagás en Mercado Pago con tarjeta, débito o dinero en cuenta."
            : `${config.vendedora_nombre} recibe tu pedido y te escribe por WhatsApp para coordinar el pago y la entrega.`}
        </p>
      </aside>
    </form>
  );
}
