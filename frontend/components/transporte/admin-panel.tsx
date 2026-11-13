"use client";

import {
  AlertTriangle,
  ExternalLink,
  ImageUp,
  MessageCircle,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import {
  FormMessage,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ConsultasAdmin,
  PaquetesAdmin,
  ReservasAdmin,
} from "@/components/transporte/admin-paquetes";
import { api, errorMessage } from "@/lib/api";
import { pesosLabel } from "@/lib/tiendas/cotizar";
import type {
  EstadoTransporte,
  PedidoTransporte,
  TransportistaAdmin,
  UnidadAdmin,
} from "@/lib/transporte/types";
import { cn } from "@/lib/utils";

const ESTADOS: Record<EstadoTransporte, string> = {
  nuevo: "Nuevo",
  confirmado: "Confirmado",
  realizado: "Realizado",
  cancelado: "Cancelado",
};

const seccion =
  "flex flex-col gap-4 rounded-card border border-border bg-card p-4 sm:p-5";
const h2 = "font-heading text-h2 font-semibold";

function Estado({
  message,
  error,
}: {
  message: string | null;
  error: string | null;
}) {
  return (
    <>
      {message ? (
        <p role="status" className="text-meta font-semibold text-success">
          {message}
        </p>
      ) : null}
      {error ? <FormMessage>{error}</FormMessage> : null}
    </>
  );
}

function useGuardar(path: string, onSaved: (t: TransportistaAdmin) => void) {
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  async function run(
    method: "POST" | "PUT" | "DELETE",
    subpath: string,
    body: unknown,
    ok: string,
  ) {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      onSaved(
        await api<TransportistaAdmin>(`${path}${subpath}`, { method, body }),
      );
      setMessage(ok);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }
  return { run, message, error, saving, setError };
}

function Datos({
  t,
  onSaved,
}: {
  t: TransportistaAdmin;
  onSaved: (t: TransportistaAdmin) => void;
}) {
  const [d, setD] = React.useState({
    nombre: t.nombre,
    descripcion: t.descripcion ?? "",
    whatsapp: t.whatsapp,
    email: t.email,
    minimo: String(Number(t.minimo)),
    espera_hora: String(Number(t.espera_hora)),
    iva_incluido: t.iva_incluido,
    sena_pct: String(t.sena_pct),
    datos_transferencia: t.datos_transferencia ?? "",
  });
  const { run, message, error, saving, setError } = useGuardar(
    `/admin/transporte/${t.slug}`,
    onSaved,
  );
  const set =
    (k: keyof typeof d) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setD((x) => ({ ...x, [k]: e.target.value }));

  function guardar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const minimo = Number(d.minimo.replace(/\./g, "").replace(",", "."));
    const espera = Number(d.espera_hora.replace(/\./g, "").replace(",", "."));
    if (
      !Number.isFinite(minimo) ||
      minimo < 0 ||
      !Number.isFinite(espera) ||
      espera < 0
    ) {
      setError(
        "Revisá el mínimo y la hora de espera: van en pesos, sin signos.",
      );
      return;
    }
    const sena = Number(d.sena_pct);
    if (!Number.isInteger(sena) || sena < 0 || sena > 100) {
      setError("La seña va en %, de 0 a 100.");
      return;
    }
    void run(
      "PUT",
      "",
      {
        ...d,
        descripcion: d.descripcion.trim() || null,
        minimo: String(minimo),
        espera_hora: String(espera),
        sena_pct: sena,
        datos_transferencia: d.datos_transferencia.trim() || null,
      },
      "Guardamos los datos y las tarifas.",
    );
  }

  return (
    <form
      onSubmit={guardar}
      noValidate
      aria-labelledby="datos-titulo"
      className={seccion}
    >
      <h2 id="datos-titulo" className={h2}>
        Datos y tarifas
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <TextField
            id="t-nombre"
            label="Nombre"
            value={d.nombre}
            onChange={set("nombre")}
            disabled={saving}
          />
        </div>
        <TextField
          id="t-whatsapp"
          label="WhatsApp para pedidos"
          type="tel"
          value={d.whatsapp}
          onChange={set("whatsapp")}
          disabled={saving}
        />
        <TextField
          id="t-email"
          label="Email para pedidos"
          type="email"
          value={d.email}
          onChange={set("email")}
          disabled={saving}
        />
        <TextField
          id="t-minimo"
          label="Mínimo por viaje ($)"
          hint="Ningún viaje cuesta menos que esto, por unidad."
          inputMode="decimal"
          value={d.minimo}
          onChange={set("minimo")}
          disabled={saving}
        />
        <TextField
          id="t-espera"
          label="Hora de espera ($)"
          hint="Se suma por cada hora que la unidad espera."
          inputMode="decimal"
          value={d.espera_hora}
          onChange={set("espera_hora")}
          disabled={saving}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <TextField
          id="t-sena"
          label="Seña de paquetes (%)"
          type="number"
          inputMode="numeric"
          value={d.sena_pct}
          onChange={set("sena_pct")}
          disabled={saving}
        />
        <TextAreaField
          id="t-transferencia"
          label="Datos para transferir la seña"
          hint="Alias, CBU y titular: se los mostramos al cliente al reservar."
          rows={2}
          maxLength={500}
          value={d.datos_transferencia}
          onChange={set("datos_transferencia")}
          disabled={saving}
        />
      </div>
      <TextAreaField
        id="t-descripcion"
        label="Descripción"
        rows={3}
        maxLength={2000}
        value={d.descripcion}
        onChange={set("descripcion")}
        disabled={saving}
      />
      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          className="size-5"
          checked={d.iva_incluido}
          onChange={(e) =>
            setD((x) => ({ ...x, iva_incluido: e.target.checked }))
          }
          disabled={saving}
        />
        Los precios incluyen IVA
      </label>
      <Button
        type="submit"
        variant="primary"
        disabled={saving}
        className="self-start"
      >
        {saving ? "Guardando…" : "Guardar datos y tarifas"}
      </Button>
      <Estado message={message} error={error} />
    </form>
  );
}

function SubirFoto({
  id,
  label,
  path,
  onSaved,
}: {
  id: string;
  label: string;
  path: string;
  onSaved: (t: TransportistaAdmin) => void;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  async function subir(file: File) {
    const body = new FormData();
    body.append("file", file);
    setSaving(true);
    setError(null);
    try {
      onSaved(await api<TransportistaAdmin>(path, { method: "POST", body }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="inline-flex h-9 cursor-pointer items-center gap-2 self-start rounded-input border border-border px-3 text-meta font-semibold focus-within:ring-2 focus-within:ring-ring hover:bg-muted"
      >
        <ImageUp aria-hidden="true" className="size-4" />
        {saving ? "Subiendo…" : label}
        <input
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={saving}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void subir(file);
          }}
        />
      </label>
      {error ? <FormMessage>{error}</FormMessage> : null}
    </div>
  );
}

function UnidadRow({
  slug,
  unidad,
  onSaved,
}: {
  slug: string;
  unidad: UnidadAdmin;
  onSaved: (t: TransportistaAdmin) => void;
}) {
  const [d, setD] = React.useState({
    nombre: unidad.nombre,
    asientos: String(unidad.asientos),
    precio_km: String(Number(unidad.precio_km)),
    activo: unidad.activo,
  });
  const { run, message, error, saving, setError } = useGuardar(
    `/admin/transporte/${slug}/unidades/${unidad.id}`,
    onSaved,
  );
  const id = `u-${unidad.id}`;

  function guardar() {
    const asientos = Number(d.asientos);
    const precio = Number(d.precio_km.replace(",", "."));
    if (
      !d.nombre.trim() ||
      !Number.isInteger(asientos) ||
      asientos < 1 ||
      !(precio > 0)
    ) {
      setError("Completá nombre, asientos y $ por km.");
      return;
    }
    void run(
      "PUT",
      "",
      {
        nombre: d.nombre.trim(),
        asientos,
        precio_km: String(precio),
        activo: d.activo,
      },
      "Guardada.",
    );
  }

  return (
    <li className="flex flex-col gap-3 rounded-input border border-border p-3">
      <div className="flex gap-3">
        {unidad.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto del bucket
          <img
            src={unidad.foto_url}
            alt={unidad.nombre}
            className="h-16 w-24 shrink-0 rounded-input bg-muted object-cover"
          />
        ) : null}
        <div className="grid flex-1 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <TextField
            id={`${id}-nombre`}
            label="Unidad"
            value={d.nombre}
            onChange={(e) => setD((x) => ({ ...x, nombre: e.target.value }))}
            disabled={saving}
          />
          <TextField
            id={`${id}-asientos`}
            label="Asientos"
            type="number"
            inputMode="numeric"
            value={d.asientos}
            onChange={(e) => setD((x) => ({ ...x, asientos: e.target.value }))}
            disabled={saving}
          />
          <TextField
            id={`${id}-precio`}
            label="$ por km"
            inputMode="decimal"
            value={d.precio_km}
            onChange={(e) => setD((x) => ({ ...x, precio_km: e.target.value }))}
            disabled={saving}
          />
        </div>
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
          variant="primary"
          onClick={guardar}
          disabled={saving}
        >
          Guardar
        </Button>
        <SubirFoto
          id={`${id}-foto`}
          label="Foto"
          path={`/admin/transporte/${slug}/unidades/${unidad.id}/foto`}
          onSaved={onSaved}
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            if (window.confirm(`¿Quitar ${unidad.nombre}?`))
              void run("DELETE", "", undefined, "");
          }}
          disabled={saving}
          aria-label={`Quitar ${unidad.nombre}`}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
      <Estado message={message} error={error} />
    </li>
  );
}

function Unidades({
  t,
  onSaved,
}: {
  t: TransportistaAdmin;
  onSaved: (t: TransportistaAdmin) => void;
}) {
  const { run, error, saving } = useGuardar(
    `/admin/transporte/${t.slug}/unidades`,
    onSaved,
  );
  return (
    <section aria-labelledby="unidades-titulo" className={seccion}>
      <div>
        <h2 id="unidades-titulo" className={h2}>
          Unidades
        </h2>
        <p className="text-meta text-muted-foreground">
          Precio de cada unidad = km × $ por km + espera, nunca menos que el
          mínimo. Si los pasajeros no entran en una, se suman unidades.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {t.unidades.map((u) => (
          <UnidadRow
            key={`${u.id}-${u.precio_km}-${u.asientos}-${u.activo}-${u.foto_url}`}
            slug={t.slug}
            unidad={u}
            onSaved={onSaved}
          />
        ))}
      </ul>
      <Button
        type="button"
        variant="outline"
        className="self-start"
        disabled={saving}
        onClick={() =>
          void run(
            "POST",
            "",
            { nombre: "Unidad nueva", asientos: 10, precio_km: "1000" },
            "",
          )
        }
      >
        <Plus aria-hidden="true" />
        Agregar unidad
      </Button>
      {error ? <FormMessage>{error}</FormMessage> : null}
    </section>
  );
}

function Pedidos({ slug }: { slug: string }) {
  const [pedidos, setPedidos] = React.useState<PedidoTransporte[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    api<PedidoTransporte[]>(`/admin/transporte/${slug}/pedidos`)
      .then(setPedidos)
      .catch((err) => setError(errorMessage(err)));
  }, [slug]);

  async function cambiar(p: PedidoTransporte, estado: EstadoTransporte) {
    try {
      const nuevo = await api<PedidoTransporte>(
        `/admin/transporte/${slug}/pedidos/${p.id}`,
        { method: "PUT", body: { estado } },
      );
      setPedidos((ps) => ps?.map((x) => (x.id === p.id ? nuevo : x)) ?? null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section aria-labelledby="pedidos-titulo" className={seccion}>
      <h2 id="pedidos-titulo" className={h2}>
        Pedidos
      </h2>
      {error ? <FormMessage>{error}</FormMessage> : null}
      {pedidos === null && !error ? <Skeleton className="h-24 w-full" /> : null}
      {pedidos?.length === 0 ? (
        <p className="text-muted-foreground">
          Todavía no hay pedidos. Te llegan también por email.
        </p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {pedidos?.map((p) => (
          <li
            key={p.id}
            className="flex flex-col gap-2 rounded-input border border-border p-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold">
                {p.codigo} · {p.empresa}
              </span>
              <span className="text-h3 font-semibold tabular-nums">
                {pesosLabel(p.total)}
              </span>
            </div>
            <p className="text-meta">
              {p.origen} → {p.destino} · {Number(p.km).toLocaleString("es-AR")}{" "}
              km{p.ida_vuelta ? " (ida y vuelta)" : ""} · {p.pasajeros}{" "}
              pasajeros ·{" "}
              {p.cantidad_unidades > 1 ? `${p.cantidad_unidades} × ` : ""}
              {p.unidad}
              {p.horas_espera ? ` · ${p.horas_espera} h de espera` : ""}
              {p.fecha ? ` · ${p.fecha.split("-").reverse().join("/")}` : ""}
            </p>
            <p className="text-meta text-muted-foreground">
              {p.nombre} · {p.telefono} · {p.email}
              {p.notas ? ` · “${p.notas}”` : ""}
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-44">
                <SelectField
                  id={`estado-${p.id}`}
                  label="Estado"
                  value={p.estado}
                  onChange={(e) =>
                    void cambiar(p, e.target.value as EstadoTransporte)
                  }
                >
                  {Object.entries(ESTADOS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </SelectField>
              </div>
              <Button asChild size="sm" variant="whatsapp">
                <a
                  href={`https://wa.me/${p.telefono.replace(/\D/g, "")}`}
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

function Encargados({ slug }: { slug: string }) {
  const [lista, setLista] = React.useState<
    { id: string; email: string | null; nombre: string }[]
  >([]);
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const path = `/admin/transporte/${slug}/encargados`;
  React.useEffect(() => {
    api<typeof lista>(path)
      .then(setLista)
      .catch(() => undefined);
  }, [path]);
  async function agregar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      const nuevo = await api<(typeof lista)[number]>(path, {
        method: "POST",
        body: { email: email.trim() },
      });
      setLista((l) => [...l.filter((x) => x.id !== nuevo.id), nuevo]);
      setEmail("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  return (
    <section aria-labelledby="encargados-titulo" className={seccion}>
      <h2 id="encargados-titulo" className={h2}>
        Encargados
      </h2>
      <ul className="flex flex-col gap-2">
        {lista.map((u) => (
          <li key={u.id} className="flex items-center justify-between gap-2">
            <span>
              {u.nombre}{" "}
              <span className="text-muted-foreground">· {u.email}</span>
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={`Quitar a ${u.nombre}`}
              onClick={() =>
                void api(`${path}/${u.id}`, { method: "DELETE" }).then(() =>
                  setLista((l) => l.filter((x) => x.id !== u.id)),
                )
              }
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={agregar}
        noValidate
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <TextField
            id="encargado-email"
            label="Email de la cuenta"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline">
          Agregar encargado
        </Button>
      </form>
      {error ? <FormMessage>{error}</FormMessage> : null}
    </section>
  );
}

type Tab = "reservas" | "consultas" | "paquetes" | "traslados" | "datos";
const TABS: [Tab, string][] = [
  ["reservas", "Reservas"],
  ["consultas", "Consultas"],
  ["paquetes", "Paquetes"],
  ["traslados", "Traslados"],
  ["datos", "Datos y tarifas"],
];

/** Panel de la empresa: reservas, consultas, paquetes, traslados y datos. */
export function TransporteAdminPanel({ slug }: { slug: string }) {
  const { user } = useAuth();
  const [t, setT] = React.useState<TransportistaAdmin | null>(null);
  const [tab, setTab] = React.useState<Tab>("reservas");
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    api<TransportistaAdmin>(`/admin/transporte/${slug}`)
      .then(setT)
      .catch((err) => setError(errorMessage(err)));
  }, [slug]);

  if (error) return <FormMessage>{error}</FormMessage>;
  if (!t) return <Skeleton className="h-64 w-full" />;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-h1 font-semibold">{t.nombre}</h1>
        <Button asChild variant="outline" size="sm">
          <Link href={`/transporte/${t.slug}`}>
            <ExternalLink aria-hidden="true" />
            Ver la página
          </Link>
        </Button>
      </div>
      {!t.tarifas_revisadas ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-card border border-accent bg-card p-4"
        >
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-accent"
          />
          <span>
            <strong>Las tarifas son de ejemplo.</strong> Revisá el mínimo, la
            hora de espera y el $ por km de cada unidad y guardalos: hasta
            entonces los clientes cotizan con estos valores.
          </span>
        </p>
      ) : null}
      <nav
        aria-label="Secciones del panel"
        className="-mx-4 flex gap-2 overflow-x-auto px-4"
      >
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-pill border px-4 font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:border-primary",
            )}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "paquetes" ? <PaquetesAdmin slug={t.slug} /> : null}
      {tab === "reservas" ? <ReservasAdmin slug={t.slug} /> : null}
      {tab === "consultas" ? <ConsultasAdmin slug={t.slug} /> : null}
      {tab === "datos" ? (
        <>
          <Datos
            key={`${t.minimo}-${t.espera_hora}-${t.iva_incluido}-${t.sena_pct}`}
            t={t}
            onSaved={setT}
          />
          <section aria-labelledby="portada-titulo" className={seccion}>
            <h2 id="portada-titulo" className={h2}>
              Foto de portada
            </h2>
            {t.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- foto del bucket
              <img
                src={t.foto_url}
                alt="Portada actual"
                className="aspect-[16/6] w-full rounded-input object-cover"
              />
            ) : (
              <p className="text-muted-foreground">
                Sin foto: se ve el fondo azul.
              </p>
            )}
            <SubirFoto
              id="portada"
              label={t.foto_url ? "Cambiar foto" : "Subir foto"}
              path={`/admin/transporte/${t.slug}/foto`}
              onSaved={setT}
            />
          </section>
          {user?.role === "admin" ? <Encargados slug={t.slug} /> : null}
        </>
      ) : null}
      {tab === "traslados" ? (
        <>
          <Pedidos slug={t.slug} />
          <Unidades t={t} onSaved={setT} />
        </>
      ) : null}
    </div>
  );
}
