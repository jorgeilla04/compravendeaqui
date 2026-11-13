"use client";

import { ArrowRightLeft, Bus, Check, MessageCircle, Users } from "lucide-react";
import * as React from "react";

import { LugarField } from "@/components/transporte/lugar-field";
import { Button } from "@/components/ui/button";
import { FormMessage, TextAreaField, TextField } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import { pesosLabel } from "@/lib/tiendas/cotizar";
import type {
  Cotizacion,
  Lugar,
  Opcion,
  PedidoCreado,
  Transportista,
  Viaje,
} from "@/lib/transporte/types";
import { cn } from "@/lib/utils";

const km = (valor: string) =>
  Number(valor).toLocaleString("es-AR", { maximumFractionDigits: 1 });

function unidadesLabel(o: Opcion) {
  return o.cantidad === 1
    ? `${o.asientos} asientos`
    : `${o.cantidad} unidades de ${o.asientos} asientos`;
}

/** Contacto y fecha para dejar el pedido con la unidad elegida. */
function PedidoForm({
  slug,
  viaje,
  opcion,
  onDone,
}: {
  slug: string;
  viaje: Viaje;
  opcion: Opcion;
  onDone: (pedido: PedidoCreado) => void;
}) {
  const [datos, setDatos] = React.useState({
    fecha: "",
    nombre: "",
    empresa: "",
    email: "",
    telefono: "",
    notas: "",
  });
  const [errores, setErrores] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const hoy = new Date().toISOString().slice(0, 10);

  const set =
    (key: keyof typeof datos) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      setDatos((d) => ({ ...d, [key]: e.target.value }));
      setErrores((er) => ({ ...er, [key]: "" }));
    };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const faltan: Record<string, string> = {};
    if (datos.nombre.trim().length < 2) faltan.nombre = "Poné tu nombre.";
    if (datos.empresa.trim().length < 2)
      faltan.empresa = "Poné el nombre o la razón social.";
    if (!/^\S+@\S+\.\S+$/.test(datos.email.trim()))
      faltan.email = "Revisá el email.";
    if (datos.telefono.replace(/\D/g, "").length < 8)
      faltan.telefono = "Poné un teléfono con código de área.";
    setErrores(faltan);
    if (Object.keys(faltan).length) {
      document.getElementById(`pedido-${Object.keys(faltan)[0]}`)?.focus();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onDone(
        await api<PedidoCreado>(`/transporte/${slug}/pedidos`, {
          method: "POST",
          body: {
            ...viaje,
            unidad_id: opcion.unidad_id,
            fecha: datos.fecha || null,
            nombre: datos.nombre.trim(),
            empresa: datos.empresa.trim(),
            email: datos.email.trim(),
            telefono: datos.telefono.trim(),
            notas: datos.notas.trim() || null,
          },
        }),
      );
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby="pedido-titulo"
      className="flex flex-col gap-3 rounded-card border border-border bg-card p-4"
    >
      <h3 id="pedido-titulo" className="font-heading text-h3 font-semibold">
        Pedir {opcion.unidad.toLowerCase()} por {pesosLabel(opcion.precio)}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          id="pedido-fecha"
          label="Fecha del viaje"
          type="date"
          min={hoy}
          value={datos.fecha}
          onChange={set("fecha")}
          optional
          disabled={saving}
        />
        <TextField
          id="pedido-empresa"
          label="Empresa o razón social"
          value={datos.empresa}
          onChange={set("empresa")}
          error={errores.empresa}
          autoComplete="organization"
          disabled={saving}
        />
        <TextField
          id="pedido-nombre"
          label="Nombre y apellido"
          value={datos.nombre}
          onChange={set("nombre")}
          error={errores.nombre}
          autoComplete="name"
          disabled={saving}
        />
        <TextField
          id="pedido-telefono"
          label="Teléfono (WhatsApp)"
          type="tel"
          value={datos.telefono}
          onChange={set("telefono")}
          error={errores.telefono}
          autoComplete="tel"
          disabled={saving}
        />
        <div className="sm:col-span-2">
          <TextField
            id="pedido-email"
            label="Email"
            type="email"
            value={datos.email}
            onChange={set("email")}
            error={errores.email}
            autoComplete="email"
            disabled={saving}
          />
        </div>
      </div>
      <TextAreaField
        id="pedido-notas"
        label="Algo más que tengamos que saber"
        hint="Horario de salida, paradas, equipaje…"
        value={datos.notas}
        onChange={set("notas")}
        maxLength={1000}
        rows={3}
        optional
        disabled={saving}
      />
      <Button type="submit" variant="accent" disabled={saving}>
        {saving ? "Enviando…" : "Enviar pedido"}
      </Button>
      {error ? <FormMessage>{error}</FormMessage> : null}
    </form>
  );
}

/**
 * Cotizador inmediato: origen, destino, pasajeros, ida y vuelta y espera. El
 * servidor calcula los km por ruta y el precio de cada unidad que sirve.
 */
export function Cotizador({ transportista }: { transportista: Transportista }) {
  const { slug } = transportista;
  const [origen, setOrigen] = React.useState<Lugar | null>(null);
  const [destino, setDestino] = React.useState<Lugar | null>(null);
  const [pasajeros, setPasajeros] = React.useState("");
  const [idaVuelta, setIdaVuelta] = React.useState(false);
  const [espera, setEspera] = React.useState("0");
  const [errores, setErrores] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [cotizacion, setCotizacion] = React.useState<{
    viaje: Viaje;
    resultado: Cotizacion;
  } | null>(null);
  const [elegida, setElegida] = React.useState<Opcion | null>(null);
  const [pedido, setPedido] = React.useState<PedidoCreado | null>(null);
  const resultadosRef = React.useRef<HTMLDivElement>(null);
  const maxAsientos = Math.max(
    0,
    ...transportista.unidades.map((u) => u.asientos),
  );

  // Si cambia el viaje, el presupuesto anterior ya no vale.
  React.useEffect(() => {
    setCotizacion(null);
    setElegida(null);
  }, [origen, destino, pasajeros, idaVuelta, espera]);

  async function cotizar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const n = Number(pasajeros);
    const faltan: Record<string, string> = {};
    if (!origen) faltan.origen = "Elegí el origen de la lista.";
    if (!destino) faltan.destino = "Elegí el destino de la lista.";
    if (!Number.isInteger(n) || n < 1 || n > 500)
      faltan.pasajeros = "Poné cuántas personas viajan (de 1 a 500).";
    setErrores(faltan);
    if (!origen || !destino || Object.keys(faltan).length) return;
    const viaje: Viaje = {
      origen: { nombre: origen.nombre, lat: origen.lat, lon: origen.lon },
      destino: { nombre: destino.nombre, lat: destino.lat, lon: destino.lon },
      pasajeros: n,
      ida_vuelta: idaVuelta,
      horas_espera: Number(espera) || 0,
    };
    setLoading(true);
    setError(null);
    try {
      const resultado = await api<Cotizacion>(`/transporte/${slug}/cotizar`, {
        method: "POST",
        body: viaje,
      });
      setCotizacion({ viaje, resultado });
      setElegida(resultado.opciones[0] ?? null);
      window.setTimeout(
        () =>
          resultadosRef.current?.scrollIntoView?.({
            behavior: "smooth",
            block: "start",
          }),
        50,
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (pedido) {
    return (
      <section
        aria-labelledby="pedido-ok"
        className="flex flex-col items-start gap-3 rounded-card border border-border bg-card p-6"
      >
        <span className="flex size-12 items-center justify-center rounded-pill bg-success text-white">
          <Check aria-hidden="true" className="size-6" />
        </span>
        <h2 id="pedido-ok" className="font-heading text-h2 font-semibold">
          Recibimos tu pedido {pedido.codigo}
        </h2>
        <p className="text-muted-foreground">
          Presupuesto estimado:{" "}
          <strong className="text-foreground">
            {pesosLabel(pedido.total)}
          </strong>
          {transportista.iva_incluido ? " (IVA incluido)" : " + IVA"}. Te
          contactamos para confirmar disponibilidad y el precio final. Si es
          urgente, escribinos ahora:
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="whatsapp">
            <a
              href={pedido.whatsapp_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle aria-hidden="true" />
              Escribir por WhatsApp
            </a>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setPedido(null);
              setCotizacion(null);
            }}
          >
            Cotizar otro viaje
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
      <form
        onSubmit={cotizar}
        noValidate
        aria-labelledby="cotizar-titulo"
        className="flex flex-col gap-4 rounded-card border border-border bg-card p-4 sm:p-5 lg:sticky lg:top-36"
      >
        <h2 id="cotizar-titulo" className="font-heading text-h2 font-semibold">
          Cotizá tu traslado
        </h2>
        <LugarField
          id="cot-origen"
          label="Origen"
          value={origen}
          onChange={(l) => {
            setOrigen(l);
            setErrores((e) => ({ ...e, origen: "" }));
          }}
          error={errores.origen}
          disabled={loading}
        />
        <LugarField
          id="cot-destino"
          label="Destino"
          value={destino}
          onChange={(l) => {
            setDestino(l);
            setErrores((e) => ({ ...e, destino: "" }));
          }}
          error={errores.destino}
          disabled={loading}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            id="cot-pasajeros"
            label="Pasajeros"
            type="number"
            inputMode="numeric"
            min={1}
            max={500}
            value={pasajeros}
            onChange={(e) => {
              setPasajeros(e.target.value);
              setErrores((er) => ({ ...er, pasajeros: "" }));
            }}
            error={errores.pasajeros}
            disabled={loading}
          />
          <TextField
            id="cot-espera"
            label="Horas de espera"
            type="number"
            inputMode="numeric"
            min={0}
            max={72}
            value={espera}
            onChange={(e) => setEspera(e.target.value)}
            disabled={loading}
          />
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-input border border-border px-3">
          <input
            type="checkbox"
            checked={idaVuelta}
            onChange={(e) => setIdaVuelta(e.target.checked)}
            disabled={loading}
            className="size-5"
          />
          <ArrowRightLeft
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          <span>Ida y vuelta</span>
        </label>
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? "Calculando…" : "Ver precios"}
        </Button>
        {error ? <FormMessage>{error}</FormMessage> : null}
      </form>

      <div ref={resultadosRef} className="flex scroll-mt-36 flex-col gap-4">
        {cotizacion ? (
          <section
            aria-labelledby="opciones-titulo"
            className="flex flex-col gap-3"
          >
            <div>
              <h2
                id="opciones-titulo"
                className="font-heading text-h2 font-semibold"
              >
                {cotizacion.resultado.opciones.length
                  ? "Elegí la unidad"
                  : "Necesitamos cotizarlo a mano"}
              </h2>
              <p className="text-meta text-muted-foreground">
                {cotizacion.viaje.origen.nombre} →{" "}
                {cotizacion.viaje.destino.nombre}: {km(cotizacion.resultado.km)}{" "}
                km por ruta
                {cotizacion.viaje.ida_vuelta
                  ? ` · ${km(cotizacion.resultado.km_cobrados)} km ida y vuelta`
                  : ""}
                {" · "}
                {cotizacion.viaje.pasajeros} pasajeros
              </p>
            </div>
            {cotizacion.resultado.opciones.length === 0 ? (
              <p>
                Son más pasajeros de los que cotizamos en línea. Escribinos y
                armamos el viaje con varias unidades.
              </p>
            ) : (
              <div
                role="radiogroup"
                aria-labelledby="opciones-titulo"
                className="grid gap-3 sm:grid-cols-2"
              >
                {cotizacion.resultado.opciones.map((o, i) => {
                  const activa = elegida?.unidad_id === o.unidad_id;
                  return (
                    <button
                      key={o.unidad_id}
                      type="button"
                      role="radio"
                      aria-checked={activa}
                      onClick={() => setElegida(o)}
                      className={cn(
                        "flex flex-col gap-2 overflow-hidden rounded-card border-2 bg-card text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        activa
                          ? "border-primary"
                          : "border-border hover:border-primary",
                      )}
                    >
                      {o.foto_url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- foto del bucket
                        <img
                          src={o.foto_url}
                          alt=""
                          className="aspect-[16/9] w-full bg-muted object-cover"
                        />
                      ) : null}
                      <span className="flex flex-col gap-1 p-4 pt-2">
                        <span className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 font-heading text-h3 font-semibold">
                            <Bus
                              aria-hidden="true"
                              className="size-5 text-primary"
                            />
                            {o.cantidad > 1 ? `${o.cantidad} × ` : ""}
                            {o.unidad}
                          </span>
                          {i === 0 ? (
                            <span className="rounded-pill bg-accent px-2 py-0.5 text-meta font-semibold text-accent-foreground">
                              Más conveniente
                            </span>
                          ) : null}
                        </span>
                        <span className="flex items-center gap-1.5 text-meta text-muted-foreground">
                          <Users aria-hidden="true" className="size-4" />
                          {unidadesLabel(o)}
                        </span>
                        <span className="text-h2 font-semibold tabular-nums">
                          {pesosLabel(o.precio)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-meta text-muted-foreground">
              Precio estimado{" "}
              {cotizacion.resultado.iva_incluido
                ? "con IVA incluido"
                : "más IVA"}
              . Te confirmamos disponibilidad y el precio final al recibir el
              pedido.
            </p>
            {elegida ? (
              <PedidoForm
                key={elegida.unidad_id}
                slug={slug}
                viaje={cotizacion.viaje}
                opcion={elegida}
                onDone={setPedido}
              />
            ) : null}
          </section>
        ) : (
          <section
            aria-labelledby="flota-titulo"
            className="flex flex-col gap-3 rounded-card border border-dashed border-border p-4 sm:p-5"
          >
            <h2
              id="flota-titulo"
              className="font-heading text-h3 font-semibold"
            >
              Unidades para cada equipo
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {transportista.unidades.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center gap-3 rounded-input bg-muted px-3 py-2.5"
                >
                  <Bus
                    aria-hidden="true"
                    className="size-5 shrink-0 text-primary"
                  />
                  <span className="font-semibold">{u.nombre}</span>
                  <span className="ml-auto text-meta text-muted-foreground">
                    hasta {u.asientos} pasajeros
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-meta text-muted-foreground">
              Cargá el viaje y te mostramos el precio de cada unidad al
              instante. Para más de {maxAsientos} pasajeros sumamos unidades.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
