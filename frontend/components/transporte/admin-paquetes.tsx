"use client";

import { ImageUp, MessageCircle, Plus, Trash2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  FormMessage,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import { pesosLabel } from "@/lib/tiendas/cotizar";
import type {
  ConsultaAdmin,
  EstadoReserva,
  PaqueteAdmin,
  ReservaAdmin,
  SalidaAdmin,
} from "@/lib/transporte/types";

const caja = "flex flex-col gap-3 rounded-input border border-border p-3";
const numero = (v: string) => Number(v.replace(/\./g, "").replace(",", "."));
const wa = (tel: string) => `https://wa.me/${tel.replace(/\D/g, "")}`;
const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
  });

function Mensajes({ ok, error }: { ok: string | null; error: string | null }) {
  return (
    <>
      {ok ? (
        <p role="status" className="text-meta font-semibold text-success">
          {ok}
        </p>
      ) : null}
      {error ? <FormMessage>{error}</FormMessage> : null}
    </>
  );
}

function SalidaRow({
  base,
  salida,
  onSaved,
}: {
  base: string;
  salida: SalidaAdmin;
  onSaved: (p: PaqueteAdmin) => void;
}) {
  const [d, setD] = React.useState({
    nombre: salida.nombre,
    fecha: salida.fecha ?? "",
    precio: String(Number(salida.precio_persona)),
    cupos: String(salida.cupos),
    activo: salida.activo,
  });
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const id = `s-${salida.id}`;
  const path = `${base}/salidas/${salida.id}`;

  async function run(method: "PUT" | "DELETE") {
    const precio = numero(d.precio);
    const cupos = Number(d.cupos);
    if (
      method === "PUT" &&
      (!d.nombre.trim() ||
        !(precio > 0) ||
        !Number.isInteger(cupos) ||
        cupos < 0)
    ) {
      setError("Completá nombre, precio por persona y cupos.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onSaved(
        await api<PaqueteAdmin>(path, {
          method,
          body:
            method === "PUT"
              ? {
                  nombre: d.nombre.trim(),
                  fecha: d.fecha || null,
                  precio_persona: String(precio),
                  cupos,
                  activo: d.activo,
                }
              : undefined,
        }),
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className={caja}>
      <div className="grid gap-3 sm:grid-cols-4">
        <TextField
          id={`${id}-nombre`}
          label="Salida"
          hint="Ej.: Enero 2027"
          value={d.nombre}
          onChange={(e) => setD((x) => ({ ...x, nombre: e.target.value }))}
          disabled={saving}
        />
        <TextField
          id={`${id}-fecha`}
          label="Fecha"
          type="date"
          optional
          value={d.fecha}
          onChange={(e) => setD((x) => ({ ...x, fecha: e.target.value }))}
          disabled={saving}
        />
        <TextField
          id={`${id}-precio`}
          label="$ por persona"
          inputMode="decimal"
          value={d.precio}
          onChange={(e) => setD((x) => ({ ...x, precio: e.target.value }))}
          disabled={saving}
        />
        <TextField
          id={`${id}-cupos`}
          label="Cupos"
          hint={`${salida.reservados} reservados`}
          type="number"
          inputMode="numeric"
          value={d.cupos}
          onChange={(e) => setD((x) => ({ ...x, cupos: e.target.value }))}
          disabled={saving}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-h-9 cursor-pointer items-center gap-2 pr-2 text-meta">
          <input
            type="checkbox"
            className="size-5"
            checked={d.activo}
            onChange={(e) => setD((x) => ({ ...x, activo: e.target.checked }))}
            disabled={saving}
          />
          Se ofrece
        </label>
        <Button
          type="button"
          size="sm"
          onClick={() => void run("PUT")}
          disabled={saving}
        >
          Guardar salida
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label={`Borrar la salida ${salida.nombre}`}
          onClick={() =>
            window.confirm(`¿Borrar la salida ${salida.nombre}?`) &&
            void run("DELETE")
          }
          disabled={saving}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
      {error ? <FormMessage>{error}</FormMessage> : null}
    </li>
  );
}

function PaqueteEditor({
  slug,
  paquete,
  onSaved,
  onDeleted,
}: {
  slug: string;
  paquete: PaqueteAdmin;
  onSaved: (p: PaqueteAdmin) => void;
  onDeleted: () => void;
}) {
  const base = `/admin/transporte/${slug}/paquetes/${paquete.slug}`;
  const [d, setD] = React.useState({
    titulo: paquete.titulo,
    resumen: paquete.resumen,
    descripcion: paquete.descripcion ?? "",
    dias: paquete.dias ? String(paquete.dias) : "",
    noches: paquete.noches != null ? String(paquete.noches) : "",
    incluye: paquete.incluye.join("\n"),
    precio: String(Number(paquete.precio_desde)),
    activo: paquete.activo,
  });
  const [ok, setOk] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const id = `p-${paquete.slug}`;
  const set =
    (k: keyof typeof d) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setD((x) => ({ ...x, [k]: e.target.value }));

  async function call<T>(
    path: string,
    method: "POST" | "PUT" | "DELETE",
    body: unknown,
    msg: string,
  ) {
    setSaving(true);
    setOk(null);
    setError(null);
    try {
      const r = await api<T>(path, { method, body });
      setOk(msg);
      return r;
    } catch (err) {
      setError(errorMessage(err));
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function guardar() {
    const precio = numero(d.precio);
    if (
      d.titulo.trim().length < 3 ||
      d.resumen.trim().length < 3 ||
      !(precio >= 0)
    ) {
      setError("Completá título, resumen y precio desde.");
      return;
    }
    const r = await call<PaqueteAdmin>(
      base,
      "PUT",
      {
        titulo: d.titulo.trim(),
        resumen: d.resumen.trim(),
        descripcion: d.descripcion.trim() || null,
        dias: d.dias ? Number(d.dias) : null,
        noches: d.noches ? Number(d.noches) : null,
        incluye: d.incluye
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean),
        precio_desde: String(precio),
        orden: paquete.orden,
        activo: d.activo,
      },
      "Guardamos el paquete.",
    );
    if (r) onSaved(r);
  }

  async function subirFoto(file: File) {
    const body = new FormData();
    body.append("file", file);
    const r = await call<PaqueteAdmin>(
      `${base}/foto`,
      "POST",
      body,
      "Foto actualizada.",
    );
    if (r) onSaved(r);
  }

  return (
    <details className="rounded-card border border-border bg-card">
      <summary className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2">
        {paquete.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto del bucket
          <img
            src={paquete.foto_url}
            alt=""
            className="h-10 w-14 shrink-0 rounded-input object-cover"
          />
        ) : null}
        <span className="flex-1 font-semibold">{paquete.titulo}</span>
        <span className="text-meta text-muted-foreground">
          {paquete.activo
            ? `${paquete.salidas.reduce((n, s) => n + s.reservados, 0)} reservados`
            : "Oculto"}
        </span>
      </summary>
      <div className="flex flex-col gap-4 border-t border-border p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField
              id={`${id}-titulo`}
              label="Título"
              value={d.titulo}
              onChange={set("titulo")}
              disabled={saving}
            />
          </div>
          <div className="sm:col-span-2">
            <TextField
              id={`${id}-resumen`}
              label="Resumen"
              hint="Una o dos líneas: se ve en el listado."
              maxLength={300}
              value={d.resumen}
              onChange={set("resumen")}
              disabled={saving}
            />
          </div>
          <TextField
            id={`${id}-dias`}
            label="Días"
            type="number"
            inputMode="numeric"
            optional
            value={d.dias}
            onChange={set("dias")}
            disabled={saving}
          />
          <TextField
            id={`${id}-noches`}
            label="Noches"
            type="number"
            inputMode="numeric"
            optional
            value={d.noches}
            onChange={set("noches")}
            disabled={saving}
          />
          <TextField
            id={`${id}-precio`}
            label="Precio desde (por persona)"
            inputMode="decimal"
            value={d.precio}
            onChange={set("precio")}
            disabled={saving}
          />
        </div>
        <TextAreaField
          id={`${id}-incluye`}
          label="Qué incluye"
          hint="Un ítem por línea."
          rows={4}
          value={d.incluye}
          onChange={set("incluye")}
          disabled={saving}
        />
        <TextAreaField
          id={`${id}-descripcion`}
          label="Detalle"
          optional
          rows={4}
          maxLength={5000}
          value={d.descripcion}
          onChange={set("descripcion")}
          disabled={saving}
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-h-9 cursor-pointer items-center gap-2 pr-2">
            <input
              type="checkbox"
              className="size-5"
              checked={d.activo}
              onChange={(e) =>
                setD((x) => ({ ...x, activo: e.target.checked }))
              }
              disabled={saving}
            />
            Publicado
          </label>
          <Button
            type="button"
            onClick={() => void guardar()}
            disabled={saving}
          >
            Guardar paquete
          </Button>
          <label
            htmlFor={`${id}-foto`}
            className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-input border border-border px-4 font-semibold focus-within:ring-2 focus-within:ring-ring hover:bg-muted"
          >
            <ImageUp aria-hidden="true" className="size-4" />
            {paquete.foto_url ? "Cambiar foto" : "Subir foto"}
            <input
              id={`${id}-foto`}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={saving}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void subirFoto(f);
              }}
            />
          </label>
          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={async () => {
              if (!window.confirm(`¿Borrar ${paquete.titulo}?`)) return;
              if ((await call(base, "DELETE", undefined, "")) !== null)
                onDeleted();
            }}
          >
            <Trash2 aria-hidden="true" />
            Borrar
          </Button>
        </div>
        <Mensajes ok={ok} error={error} />
        <h3 className="font-heading text-h3 font-semibold">Salidas y cupos</h3>
        <ul className="flex flex-col gap-3">
          {paquete.salidas.map((s) => (
            <SalidaRow
              key={`${s.id}-${s.cupos}-${s.reservados}-${s.precio_persona}-${s.activo}`}
              base={base}
              salida={s}
              onSaved={onSaved}
            />
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          className="self-start"
          disabled={saving}
          onClick={async () => {
            const r = await call<PaqueteAdmin>(
              `${base}/salidas`,
              "POST",
              {
                nombre: "Nueva salida",
                precio_persona: String(Number(paquete.precio_desde) || 1),
                cupos: 40,
              },
              "",
            );
            if (r) onSaved(r);
          }}
        >
          <Plus aria-hidden="true" />
          Agregar salida
        </Button>
      </div>
    </details>
  );
}

export function PaquetesAdmin({ slug }: { slug: string }) {
  const [lista, setLista] = React.useState<PaqueteAdmin[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    api<PaqueteAdmin[]>(`/admin/transporte/${slug}/paquetes`)
      .then(setLista)
      .catch((err) => setError(errorMessage(err)));
  }, [slug]);
  const reemplazar = (p: PaqueteAdmin) =>
    setLista((l) => l?.map((x) => (x.slug === p.slug ? p : x)) ?? null);

  async function nuevo() {
    try {
      const p = await api<PaqueteAdmin>(`/admin/transporte/${slug}/paquetes`, {
        method: "POST",
        body: {
          titulo: "Paquete nuevo",
          resumen: "Contá en una línea qué incluye.",
          precio_desde: "0",
          activo: false,
          orden: lista?.length ?? 0,
        },
      });
      setLista((l) => [...(l ?? []), p]);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section aria-labelledby="paquetes-admin" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="paquetes-admin" className="font-heading text-h2 font-semibold">
          Paquetes
        </h2>
        <Button type="button" variant="accent" onClick={() => void nuevo()}>
          <Plus aria-hidden="true" />
          Nuevo paquete
        </Button>
      </div>
      <p className="text-meta text-muted-foreground">
        Cada salida tiene su precio por persona y sus cupos: al reservar se
        descuentan, y al cancelar una reserva vuelven.
      </p>
      {error ? <FormMessage>{error}</FormMessage> : null}
      {lista === null && !error ? <Skeleton className="h-40 w-full" /> : null}
      {lista?.map((p) => (
        <PaqueteEditor
          key={p.slug}
          slug={slug}
          paquete={p}
          onSaved={reemplazar}
          onDeleted={() =>
            setLista((l) => l?.filter((x) => x.slug !== p.slug) ?? null)
          }
        />
      ))}
    </section>
  );
}

const ESTADOS_RESERVA: Record<EstadoReserva, string> = {
  pendiente_sena: "Pendiente de seña",
  senada: "Señada",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
};

export function ReservasAdmin({ slug }: { slug: string }) {
  const [lista, setLista] = React.useState<ReservaAdmin[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    api<ReservaAdmin[]>(`/admin/transporte/${slug}/reservas`)
      .then(setLista)
      .catch((err) => setError(errorMessage(err)));
  }, [slug]);

  async function cambiar(r: ReservaAdmin, estado: EstadoReserva) {
    setError(null);
    try {
      const nueva = await api<ReservaAdmin>(
        `/admin/transporte/${slug}/reservas/${r.id}`,
        { method: "PUT", body: { estado } },
      );
      setLista((l) => l?.map((x) => (x.id === r.id ? nueva : x)) ?? null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section aria-labelledby="reservas-admin" className="flex flex-col gap-3">
      <h2 id="reservas-admin" className="font-heading text-h2 font-semibold">
        Reservas
      </h2>
      <p className="text-meta text-muted-foreground">
        Cuando llegue el comprobante, pasala a &quot;Señada&quot;. Si no la
        pagan, cancelala: los lugares vuelven a la venta.
      </p>
      {error ? <FormMessage>{error}</FormMessage> : null}
      {lista === null && !error ? <Skeleton className="h-24 w-full" /> : null}
      {lista?.length === 0 ? (
        <p className="text-muted-foreground">Todavía no hay reservas.</p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {lista?.map((r) => (
          <li key={r.id} className={caja}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold">
                {r.codigo} · {r.paquete_titulo}
              </span>
              <span className="tabular-nums">
                <strong>{pesosLabel(r.total)}</strong> · seña{" "}
                {pesosLabel(r.sena)}
              </span>
            </div>
            <p className="text-meta">
              {r.salida_nombre} · {r.pasajeros} pasajeros · {r.nombre}
              {r.dni ? ` (DNI ${r.dni})` : ""} · {r.telefono} · {r.email} ·{" "}
              {fecha(r.created_at)}
            </p>
            {r.notas ? (
              <p className="text-meta text-muted-foreground">“{r.notas}”</p>
            ) : null}
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-52">
                <SelectField
                  id={`reserva-${r.id}`}
                  label="Estado"
                  value={r.estado}
                  onChange={(e) =>
                    void cambiar(r, e.target.value as EstadoReserva)
                  }
                >
                  {Object.entries(ESTADOS_RESERVA).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </SelectField>
              </div>
              <Button asChild size="sm" variant="whatsapp">
                <a
                  href={wa(r.telefono)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle aria-hidden="true" />
                  WhatsApp
                </a>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ConsultasAdmin({ slug }: { slug: string }) {
  const [lista, setLista] = React.useState<ConsultaAdmin[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    api<ConsultaAdmin[]>(`/admin/transporte/${slug}/consultas`)
      .then(setLista)
      .catch((err) => setError(errorMessage(err)));
  }, [slug]);

  async function responder(c: ConsultaAdmin) {
    try {
      const nueva = await api<ConsultaAdmin>(
        `/admin/transporte/${slug}/consultas/${c.id}`,
        {
          method: "PUT",
          body: { estado: c.estado === "nueva" ? "respondida" : "nueva" },
        },
      );
      setLista((l) => l?.map((x) => (x.id === c.id ? nueva : x)) ?? null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section aria-labelledby="consultas-admin" className="flex flex-col gap-3">
      <h2 id="consultas-admin" className="font-heading text-h2 font-semibold">
        Consultas
      </h2>
      {error ? <FormMessage>{error}</FormMessage> : null}
      {lista === null && !error ? <Skeleton className="h-24 w-full" /> : null}
      {lista?.length === 0 ? (
        <p className="text-muted-foreground">
          Todavía no hay consultas. También te llegan por email.
        </p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {lista?.map((c) => (
          <li key={c.id} className={caja}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold">
                {c.nombre} · {c.telefono}
              </span>
              <span
                className={
                  c.estado === "nueva"
                    ? "text-meta font-semibold text-primary"
                    : "text-meta text-muted-foreground"
                }
              >
                {c.estado === "nueva" ? "Nueva" : "Respondida"} ·{" "}
                {fecha(c.created_at)}
              </span>
            </div>
            <p className="text-meta">
              {c.paquete_titulo ?? "Consulta general"}
              {c.email ? ` · ${c.email}` : ""}
            </p>
            {c.mensaje ? <p>{c.mensaje}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="whatsapp">
                <a
                  href={wa(c.telefono)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle aria-hidden="true" />
                  Responder
                </a>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void responder(c)}
              >
                {c.estado === "nueva"
                  ? "Marcar respondida"
                  : "Marcar como nueva"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
