"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { FormMessage, TextAreaField, TextField } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import { DEPARTMENTS } from "@/lib/constants";
import { pesosLabel } from "@/lib/tiendas/cotizar";
import type { TiendaAdmin, TiendaConfig } from "@/lib/tiendas/types";

const check =
  "size-5 shrink-0 accent-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Toggle({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="flex min-h-11 items-center gap-3 font-semibold"
      >
        <input
          id={id}
          type="checkbox"
          className={check}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="pl-8 text-meta text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset
      aria-labelledby={id}
      className="flex flex-col gap-4 rounded-card border border-border bg-card p-4"
    >
      <legend id={id} className="px-1 font-heading text-h3 font-semibold">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

/** Ejemplo en vivo con la config que se está editando. */
export function ejemploExpress(c: TiendaConfig, productos = 30000): string {
  const envio = Number(c.envio_monto || 0);
  const recargo =
    Math.floor((productos * Number(c.express_recargo_pct || 0)) / 100 + 0.5) +
    Number(c.express_monto || 0);
  return `Con ${pesosLabel(productos)} en productos, el express cuesta ${pesosLabel(
    envio + recargo,
  )} (envío ${pesosLabel(envio)} + ${pesosLabel(recargo)}).`;
}

export function ConfigAdmin({
  tienda,
  onSaved,
}: {
  tienda: TiendaAdmin;
  onSaved: (t: TiendaAdmin) => void;
}) {
  const { slug, ...initial } = tienda;
  const [c, setC] = React.useState<TiendaConfig>({
    ...initial,
    envio_monto: String(Number(initial.envio_monto)),
    express_monto: String(Number(initial.express_monto)),
    envio_gratis_desde:
      initial.envio_gratis_desde === null
        ? null
        : String(Number(initial.envio_gratis_desde)),
  });
  const [categorias, setCategorias] = React.useState(
    initial.categorias.join("\n"),
  );
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);

  function set<K extends keyof TiendaConfig>(key: K, value: TiendaConfig[K]) {
    setC((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const saved = await api<TiendaAdmin>(`/admin/tiendas/${slug}`, {
        method: "PUT",
        body: {
          ...c,
          envio_monto: c.envio_monto || "0",
          express_monto: c.express_monto || "0",
          envio_gratis_desde: c.envio_gratis_desde || null,
          retiro_direccion: c.retiro_direccion?.trim() || null,
          descripcion: c.descripcion?.trim() || null,
          categorias: categorias.split("\n"),
        },
      });
      onSaved(saved);
      setMessage({ tone: "success", text: "Guardamos la configuración." });
    } catch (err) {
      setMessage({ tone: "error", text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  const money = (
    key: "envio_monto" | "express_monto" | "envio_gratis_desde",
  ) => ({
    type: "number" as const,
    inputMode: "numeric" as const,
    min: 0,
    step: 100,
    value: c[key] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      set(
        key,
        key === "envio_gratis_desde" && !e.target.value ? null : e.target.value,
      ),
  });

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <Section id="cfg-envio" title="Envío a domicilio">
        <Toggle
          id="envio_habilitado"
          label="Hago envíos a domicilio"
          checked={c.envio_habilitado}
          onChange={(v) => set("envio_habilitado", v)}
        />
        {c.envio_habilitado ? (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField
                id="envio_monto"
                label="Costo del envío ($)"
                hint="0 = envío gratis."
                {...money("envio_monto")}
              />
              <TextField
                id="envio_gratis_desde"
                label="Gratis desde ($)"
                optional
                hint="Si el pedido llega a este monto en productos."
                {...money("envio_gratis_desde")}
              />
              <TextField
                id="envio_demora"
                label="Demora"
                hint="Ej.: 48 hs, 3 días hábiles."
                value={c.envio_demora}
                onChange={(e) => set("envio_demora", e.target.value)}
              />
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-meta font-semibold">
                Departamentos a los que llega
              </legend>
              <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-3">
                {DEPARTMENTS.map((d) => (
                  <label key={d} className="flex min-h-11 items-center gap-3">
                    <input
                      type="checkbox"
                      className={check}
                      checked={c.departamentos_envio.includes(d)}
                      onChange={(e) =>
                        set(
                          "departamentos_envio",
                          e.target.checked
                            ? [...c.departamentos_envio, d]
                            : c.departamentos_envio.filter((x) => x !== d),
                        )
                      }
                    />
                    {d}
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        ) : null}
      </Section>

      {c.envio_habilitado ? (
        <Section id="cfg-express" title="Envío express">
          <Toggle
            id="express_habilitado"
            label="Ofrezco envío express"
            hint="Se cobra el envío más un recargo."
            checked={c.express_habilitado}
            onChange={(v) => set("express_habilitado", v)}
          />
          {c.express_habilitado ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField
                  id="express_recargo_pct"
                  label="Recargo (% de los productos)"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={200}
                  value={String(c.express_recargo_pct)}
                  onChange={(e) =>
                    set("express_recargo_pct", Number(e.target.value) || 0)
                  }
                />
                <TextField
                  id="express_monto"
                  label="Recargo fijo ($)"
                  optional
                  {...money("express_monto")}
                />
                <TextField
                  id="express_demora"
                  label="Demora"
                  hint="Ej.: 24 hs, el mismo día."
                  value={c.express_demora}
                  onChange={(e) => set("express_demora", e.target.value)}
                />
              </div>
              <p className="text-meta text-muted-foreground" aria-live="polite">
                {ejemploExpress(c)}
              </p>
            </>
          ) : null}
        </Section>
      ) : null}

      <Section id="cfg-retiro" title="Retiro en el local">
        <Toggle
          id="retiro_habilitado"
          label="Se puede retirar sin costo"
          checked={c.retiro_habilitado}
          onChange={(v) => set("retiro_habilitado", v)}
        />
        {c.retiro_habilitado ? (
          <TextField
            id="retiro_direccion"
            label="Dirección de retiro"
            value={c.retiro_direccion ?? ""}
            onChange={(e) => set("retiro_direccion", e.target.value)}
          />
        ) : null}
      </Section>

      <Section id="cfg-pago" title="Formas de pago (Mercado Pago)">
        <Toggle
          id="sena_habilitada"
          label="Seña por adelantado"
          hint="El cliente paga un % de los productos más el envío; el resto, en la entrega."
          checked={c.sena_habilitada}
          onChange={(v) => set("sena_habilitada", v)}
        />
        {c.sena_habilitada ? (
          <TextField
            id="sena_pct"
            label="Seña (% de los productos)"
            type="number"
            inputMode="numeric"
            min={1}
            max={99}
            className="sm:max-w-40"
            value={String(c.sena_pct)}
            onChange={(e) => set("sena_pct", Number(e.target.value) || 0)}
          />
        ) : null}
        <Toggle
          id="total_habilitado"
          label="Pago total por adelantado"
          checked={c.total_habilitado}
          onChange={(v) => set("total_habilitado", v)}
        />
      </Section>

      <Section id="cfg-datos" title="Datos de la tienda">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="nombre"
            label="Nombre de la tienda"
            value={c.nombre}
            onChange={(e) => set("nombre", e.target.value)}
          />
          <TextField
            id="vendedor_nombre"
            label="Quién atiende"
            value={c.vendedor_nombre}
            onChange={(e) => set("vendedor_nombre", e.target.value)}
          />
          <TextField
            id="vendedor_email"
            label="Email para los pedidos"
            type="email"
            value={c.vendedor_email}
            onChange={(e) => set("vendedor_email", e.target.value)}
          />
          <TextField
            id="vendedor_whatsapp"
            label="WhatsApp para consultas"
            type="tel"
            value={c.vendedor_whatsapp}
            onChange={(e) => set("vendedor_whatsapp", e.target.value)}
          />
          <TextField
            id="grupo_label"
            label="Cómo se llaman los grupos"
            hint="Ej.: Colegio, Rubro, Lista."
            value={c.grupo_label}
            onChange={(e) => set("grupo_label", e.target.value)}
          />
          <TextField
            id="opcion_label"
            label="Cómo se llaman las opciones"
            hint="Ej.: Talle, Color, Medida."
            value={c.opcion_label}
            onChange={(e) => set("opcion_label", e.target.value)}
          />
        </div>
        <TextAreaField
          id="descripcion"
          label="Descripción"
          optional
          rows={2}
          maxLength={500}
          value={c.descripcion ?? ""}
          onChange={(e) => set("descripcion", e.target.value)}
        />
        <TextAreaField
          id="categorias"
          label="Categorías de grupos (una por línea)"
          optional
          rows={3}
          value={categorias}
          onChange={(e) => setCategorias(e.target.value)}
        />
        <Toggle
          id="productos_en_todos"
          label="Cada producto se vende en todos los grupos"
          hint="Si lo destildás, cada producto aparece solo en los grupos donde lo habilites."
          checked={c.productos_en_todos}
          onChange={(v) => set("productos_en_todos", v)}
        />
        <Toggle
          id="activo"
          label="Tienda abierta al público"
          checked={c.activo}
          onChange={(v) => set("activo", v)}
        />
      </Section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" variant="accent" size="lg" disabled={saving}>
          {saving ? "Guardando…" : "Guardar configuración"}
        </Button>
        {message ? (
          <FormMessage tone={message.tone}>{message.text}</FormMessage>
        ) : null}
      </div>
    </form>
  );
}
