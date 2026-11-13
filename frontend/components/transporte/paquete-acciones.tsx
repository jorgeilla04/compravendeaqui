"use client";

import { CalendarDays, Check, MessageCircle, Minus, Plus } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { FormMessage, TextAreaField, TextField } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import { pesosLabel } from "@/lib/tiendas/cotizar";
import type { Paquete, ReservaCreada } from "@/lib/transporte/types";
import { cn } from "@/lib/utils";

const stepper =
  "inline-flex size-11 items-center justify-center rounded-input border border-border bg-card transition-colors duration-200 hover:border-primary disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function validarContacto(d: {
  nombre: string;
  telefono: string;
  email?: string;
}) {
  const e: Record<string, string> = {};
  if (d.nombre.trim().length < 2) e.nombre = "Poné tu nombre.";
  if (d.telefono.replace(/\D/g, "").length < 8)
    e.telefono = "Poné un teléfono con código de área.";
  if (d.email !== undefined && !/^\S+@\S+\.\S+$/.test(d.email.trim()))
    e.email = "Revisá el email.";
  return e;
}

/** Elegir salida y pasajeros, dejar los datos y reservar con seña. */
export function ReservarPaquete({
  transportista,
  paquete,
}: {
  transportista: string;
  paquete: Paquete;
}) {
  const conLugar = paquete.salidas.filter((s) => s.disponibles > 0);
  const [salidaId, setSalidaId] = React.useState(conLugar[0]?.id ?? "");
  const [pasajeros, setPasajeros] = React.useState(2);
  const [d, setD] = React.useState({
    nombre: "",
    email: "",
    telefono: "",
    dni: "",
    notas: "",
  });
  const [errores, setErrores] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [reserva, setReserva] = React.useState<ReservaCreada | null>(null);
  const okRef = React.useRef<HTMLElement>(null);
  // Al reservar, el aviso con los datos de la seña queda a la vista.
  React.useEffect(() => {
    if (!reserva) return;
    okRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    okRef.current?.focus();
  }, [reserva]);
  const salida = paquete.salidas.find((s) => s.id === salidaId);
  const max = Math.min(20, salida?.disponibles ?? 1);
  const cantidad = Math.min(pasajeros, Math.max(1, max));
  const total = salida ? Number(salida.precio_persona) * cantidad : 0;
  const sena = Math.round((total * paquete.sena_pct) / 100);

  const set =
    (k: keyof typeof d) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      setD((x) => ({ ...x, [k]: e.target.value }));
      setErrores((x) => ({ ...x, [k]: "" }));
    };

  async function reservar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const faltan = validarContacto(d);
    setErrores(faltan);
    if (Object.keys(faltan).length) {
      document.getElementById(`res-${Object.keys(faltan)[0]}`)?.focus();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      setReserva(
        await api<ReservaCreada>(
          `/transporte/${transportista}/paquetes/${paquete.slug}/reservas`,
          {
            method: "POST",
            body: {
              salida_id: salidaId,
              pasajeros: cantidad,
              nombre: d.nombre.trim(),
              email: d.email.trim(),
              telefono: d.telefono.trim(),
              dni: d.dni.trim() || null,
              notas: d.notas.trim() || null,
            },
          },
        ),
      );
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  if (reserva) {
    return (
      <section
        ref={okRef}
        tabIndex={-1}
        aria-labelledby="reserva-ok"
        className="flex scroll-mt-36 flex-col gap-3 rounded-card focus:outline-none border border-border bg-card p-5"
      >
        <span className="flex size-12 items-center justify-center rounded-pill bg-success text-white">
          <Check aria-hidden="true" className="size-6" />
        </span>
        <h2 id="reserva-ok" className="font-heading text-h2 font-semibold">
          Reservaste: {reserva.codigo}
        </h2>
        <p>
          Total {pesosLabel(reserva.total)}. Tus lugares quedan apartados: para
          confirmarlos, pagá la seña de{" "}
          <strong>{pesosLabel(reserva.sena)}</strong> ({reserva.sena_pct}%).
        </p>
        {reserva.datos_transferencia ? (
          <div className="rounded-input bg-muted p-3">
            <p className="text-meta font-semibold">Datos para transferir</p>
            <p className="whitespace-pre-line font-semibold">
              {reserva.datos_transferencia}
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground">
            Te escribimos para coordinar el pago de la seña.
          </p>
        )}
        <p className="text-meta text-muted-foreground">
          Te mandamos todo por email. Pasanos el comprobante por WhatsApp:
        </p>
        <Button asChild variant="whatsapp" className="self-start">
          <a
            href={reserva.whatsapp_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle aria-hidden="true" />
            Enviar comprobante
          </a>
        </Button>
      </section>
    );
  }

  if (conLugar.length === 0) {
    return (
      <section
        aria-labelledby="sin-salidas"
        className="flex flex-col gap-2 rounded-card border border-dashed border-border p-5"
      >
        <h2 id="sin-salidas" className="font-heading text-h3 font-semibold">
          {paquete.salidas.length ? "Salidas completas" : "Fechas a confirmar"}
        </h2>
        <p className="text-muted-foreground">
          Dejanos tu consulta y te avisamos apenas haya lugares o fechas nuevas.
        </p>
      </section>
    );
  }

  return (
    <form
      onSubmit={reservar}
      noValidate
      aria-labelledby="reservar-titulo"
      className="flex flex-col gap-4 rounded-card border border-border bg-card p-4 sm:p-5"
    >
      <h2 id="reservar-titulo" className="font-heading text-h2 font-semibold">
        Reservá tu lugar
      </h2>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-meta font-semibold">Salida</legend>
        <div
          role="radiogroup"
          aria-label="Salida"
          className="grid gap-2 sm:grid-cols-2"
        >
          {paquete.salidas.map((s) => {
            const activa = s.id === salidaId;
            const llena = s.disponibles === 0;
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={activa}
                disabled={llena || saving}
                onClick={() => setSalidaId(s.id)}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-input border-2 px-3 py-2.5 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                  activa
                    ? "border-primary bg-card"
                    : "border-border hover:border-primary",
                )}
              >
                <span className="flex items-center gap-2 font-semibold">
                  <CalendarDays
                    aria-hidden="true"
                    className="size-4 text-primary"
                  />
                  {s.nombre}
                </span>
                <span className="text-meta">
                  {pesosLabel(s.precio_persona)} por persona
                </span>
                <span
                  className={cn(
                    "text-meta",
                    s.disponibles <= 5
                      ? "font-semibold text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {llena
                    ? "Completa"
                    : s.disponibles <= 5
                      ? `¡Quedan ${s.disponibles} lugares!`
                      : `${s.disponibles} lugares`}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span id="res-pasajeros" className="text-meta font-semibold">
          Pasajeros
        </span>
        <div
          role="group"
          aria-labelledby="res-pasajeros"
          className="flex items-center gap-2"
        >
          <button
            type="button"
            className={stepper}
            onClick={() => setPasajeros(Math.max(1, cantidad - 1))}
            disabled={cantidad <= 1 || saving}
            aria-label="Un pasajero menos"
          >
            <Minus aria-hidden="true" className="size-4" />
          </button>
          <output
            aria-live="polite"
            className="min-w-8 text-center text-h3 font-semibold"
          >
            {cantidad}
          </output>
          <button
            type="button"
            className={stepper}
            onClick={() => setPasajeros(Math.min(max, cantidad + 1))}
            disabled={cantidad >= max || saving}
            aria-label="Un pasajero más"
          >
            <Plus aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-1 rounded-input bg-muted p-3">
        <dt className="text-meta text-muted-foreground">Total</dt>
        <dd className="text-right text-h3 font-semibold tabular-nums">
          {pesosLabel(total)}
        </dd>
        <dt className="text-meta text-muted-foreground">
          Seña para reservar ({paquete.sena_pct}%)
        </dt>
        <dd className="text-right font-semibold tabular-nums">
          {pesosLabel(sena)}
        </dd>
      </dl>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          id="res-nombre"
          label="Nombre y apellido"
          autoComplete="name"
          value={d.nombre}
          onChange={set("nombre")}
          error={errores.nombre}
          disabled={saving}
        />
        <TextField
          id="res-dni"
          label="DNI"
          inputMode="numeric"
          value={d.dni}
          onChange={set("dni")}
          optional
          disabled={saving}
        />
        <TextField
          id="res-telefono"
          label="Teléfono (WhatsApp)"
          type="tel"
          autoComplete="tel"
          value={d.telefono}
          onChange={set("telefono")}
          error={errores.telefono}
          disabled={saving}
        />
        <TextField
          id="res-email"
          label="Email"
          type="email"
          autoComplete="email"
          value={d.email}
          onChange={set("email")}
          error={errores.email}
          disabled={saving}
        />
      </div>
      <TextAreaField
        id="res-notas"
        label="Comentarios"
        hint="Habitación, edades de los menores, desde dónde subís…"
        rows={2}
        maxLength={1000}
        value={d.notas}
        onChange={set("notas")}
        optional
        disabled={saving}
      />
      <Button type="submit" variant="accent" size="lg" disabled={saving}>
        {saving ? "Reservando…" : `Reservar con ${pesosLabel(sena)} de seña`}
      </Button>
      {error ? <FormMessage>{error}</FormMessage> : null}
    </form>
  );
}

/** Dejar los datos para que la agencia contacte (sin reservar). */
export function ConsultarPaquete({
  transportista,
  paquete,
  whatsappUrl,
}: {
  transportista: string;
  paquete?: string;
  whatsappUrl: string;
}) {
  const [d, setD] = React.useState({ nombre: "", telefono: "", mensaje: "" });
  const [errores, setErrores] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [listo, setListo] = React.useState(false);

  async function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const faltan = validarContacto(d);
    setErrores(faltan);
    if (Object.keys(faltan).length) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/transporte/${transportista}/consultas`, {
        method: "POST",
        body: {
          paquete: paquete ?? null,
          nombre: d.nombre.trim(),
          telefono: d.telefono.trim(),
          mensaje: d.mensaje.trim() || null,
        },
      });
      setListo(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      aria-labelledby="consulta-titulo"
      className="flex flex-col gap-3 rounded-card border border-border bg-card p-4 sm:p-5"
    >
      <h2 id="consulta-titulo" className="font-heading text-h3 font-semibold">
        ¿Tenés dudas? Te llamamos
      </h2>
      {listo ? (
        <p
          role="status"
          className="flex items-center gap-2 font-semibold text-success"
        >
          <Check aria-hidden="true" className="size-5" />
          Listo, te contactamos a la brevedad.
        </p>
      ) : (
        <form onSubmit={enviar} noValidate className="flex flex-col gap-3">
          <TextField
            id="con-nombre"
            label="Nombre"
            autoComplete="name"
            value={d.nombre}
            onChange={(e) => setD((x) => ({ ...x, nombre: e.target.value }))}
            error={errores.nombre}
            disabled={saving}
          />
          <TextField
            id="con-telefono"
            label="Teléfono (WhatsApp)"
            type="tel"
            autoComplete="tel"
            value={d.telefono}
            onChange={(e) => setD((x) => ({ ...x, telefono: e.target.value }))}
            error={errores.telefono}
            disabled={saving}
          />
          <TextAreaField
            id="con-mensaje"
            label="Tu consulta"
            rows={2}
            maxLength={1000}
            value={d.mensaje}
            onChange={(e) => setD((x) => ({ ...x, mensaje: e.target.value }))}
            optional
            disabled={saving}
          />
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Enviando…" : "Quiero que me contacten"}
          </Button>
          {error ? <FormMessage>{error}</FormMessage> : null}
        </form>
      )}
      <Button asChild variant="whatsapp" className="self-start">
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
          <MessageCircle aria-hidden="true" />
          Consultar por WhatsApp
        </a>
      </Button>
    </section>
  );
}
