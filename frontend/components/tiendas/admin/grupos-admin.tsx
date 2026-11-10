"use client";

import { ImageUp, Search } from "lucide-react";
import * as React from "react";

import { filterGrupos } from "@/components/tiendas/grupo-explorer";
import { GrupoLogo } from "@/components/tiendas/grupo-logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormMessage, SelectField, TextField } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  GrupoAdmin,
  PrecioGrupo,
  ProductoAdmin,
  TiendaAdmin,
} from "@/lib/tiendas/types";

interface Draft {
  nombre: string;
  subtitulo: string;
  categoria: string;
  color1: string;
  color2: string;
  activo: boolean;
}

function GrupoForm({
  tienda,
  initial,
  submitLabel,
  onSubmit,
  idPrefix,
}: {
  tienda: TiendaAdmin;
  initial: Draft;
  submitLabel: string;
  onSubmit: (draft: Draft) => Promise<void>;
  idPrefix: string;
}) {
  const [draft, setDraft] = React.useState<Draft>(initial);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.nombre.trim().length < 2) {
      setMessage({ tone: "error", text: "Completá el nombre." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await onSubmit({ ...draft, nombre: draft.nombre.trim() });
      setMessage({ tone: "success", text: "Guardado." });
    } catch (err) {
      setMessage({ tone: "error", text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="grid gap-3 sm:grid-cols-2"
    >
      <TextField
        id={`${idPrefix}-nombre`}
        label="Nombre"
        value={draft.nombre}
        onChange={(e) => set("nombre", e.target.value)}
        disabled={saving}
        required
      />
      <TextField
        id={`${idPrefix}-subtitulo`}
        label="Detalle"
        optional
        hint="Ej.: el departamento."
        value={draft.subtitulo}
        onChange={(e) => set("subtitulo", e.target.value)}
        disabled={saving}
      />
      {tienda.categorias.length > 0 ? (
        <SelectField
          id={`${idPrefix}-categoria`}
          label="Categoría"
          value={draft.categoria}
          onChange={(e) => set("categoria", e.target.value)}
          disabled={saving}
        >
          <option value="">Sin categoría</option>
          {tienda.categorias.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectField>
      ) : null}
      <div className="flex gap-3">
        {(["color1", "color2"] as const).map((key, i) => (
          <label
            key={key}
            htmlFor={`${idPrefix}-${key}`}
            className="flex flex-col gap-1.5 text-meta font-semibold"
          >
            {i === 0 ? "Color principal" : "Color secundario"}
            <input
              id={`${idPrefix}-${key}`}
              type="color"
              value={draft[key]}
              onChange={(e) => set(key, e.target.value.toUpperCase())}
              disabled={saving}
              className="h-11 w-20 cursor-pointer rounded-input border border-border bg-card p-1"
            />
          </label>
        ))}
      </div>
      <label
        htmlFor={`${idPrefix}-activo`}
        className="flex min-h-11 items-center gap-3 text-base"
      >
        <input
          id={`${idPrefix}-activo`}
          type="checkbox"
          checked={draft.activo}
          onChange={(e) => set("activo", e.target.checked)}
          disabled={saving}
          className="size-5 accent-[var(--color-primary)]"
        />
        Visible en la tienda
      </label>
      <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:items-center">
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? "Guardando…" : submitLabel}
        </Button>
        {message ? (
          <FormMessage tone={message.tone}>{message.text}</FormMessage>
        ) : null}
      </div>
    </form>
  );
}

function LogoUpload({
  slug,
  grupo,
  onUploaded,
}: {
  slug: string;
  grupo: GrupoAdmin;
  onUploaded: (g: GrupoAdmin) => void;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const id = `logo-${grupo.slug}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-meta font-semibold">
        Logo o escudo del colegio
      </label>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        className="text-meta"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          setError(null);
          const form = new FormData();
          form.append("file", file, file.name);
          try {
            onUploaded(
              await api<GrupoAdmin>(
                `/admin/tiendas/${slug}/grupos/${grupo.slug}/logo`,
                { method: "POST", body: form },
              ),
            );
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      />
      {error ? <FormMessage>{error}</FormMessage> : null}
    </div>
  );
}

const IMAGENES = "image/jpeg,image/png,image/webp";

/** Sube un archivo elegido y devuelve lo que responda la API. */
function useUpload<T>() {
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  async function run(
    path: string,
    init: { method: "POST"; file: File } | { method: "DELETE" },
    onOk: (data: T) => void,
  ) {
    setBusy(true);
    setError(null);
    try {
      let body: FormData | undefined;
      if (init.method === "POST") {
        body = new FormData();
        body.append("file", init.file, init.file.name);
      }
      onOk(await api<T>(path, { method: init.method, body }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return { error, busy, run };
}

function GaleriaGrupo({
  slug,
  grupo,
  onChange,
}: {
  slug: string;
  grupo: GrupoAdmin;
  onChange: (g: GrupoAdmin) => void;
}) {
  const { error, busy, run } = useUpload<GrupoAdmin>();
  const base = `/admin/tiendas/${slug}/grupos/${grupo.slug}/fotos`;
  const id = `galeria-${grupo.slug}`;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-meta font-semibold">
        Fotos del uniforme completo
      </legend>
      {(grupo.fotos ?? []).length > 0 ? (
        <ul className="flex flex-wrap gap-3">
          {(grupo.fotos ?? []).map((url, i) => (
            <li key={url} className="flex flex-col items-center gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- foto del bucket */}
              <img
                src={url}
                alt={`Foto ${i + 1} de ${grupo.nombre}`}
                className="size-24 rounded-input border border-border object-contain"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() =>
                  run(`${base}/${i}`, { method: "DELETE" }, onChange)
                }
                aria-label={`Quitar foto ${i + 1} de ${grupo.nombre}`}
              >
                Quitar
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <label htmlFor={id} className="text-meta">
        Agregar foto
      </label>
      <input
        id={id}
        type="file"
        accept={IMAGENES}
        disabled={busy}
        className="text-meta"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void run(base, { method: "POST", file }, onChange);
        }}
      />
      {error ? <FormMessage>{error}</FormMessage> : null}
    </fieldset>
  );
}

type Fila = { precio: string; suspendido: boolean };

function filaInicial(
  precio: PrecioGrupo | undefined,
  porDefecto: boolean,
): Fila {
  return {
    precio: precio?.precio ? String(Number(precio.precio)) : "",
    suspendido: !(precio?.disponible ?? porDefecto),
  };
}

function FotoProducto({
  slug,
  grupo,
  producto,
  precio,
  onPrecio,
}: {
  slug: string;
  grupo: GrupoAdmin;
  producto: ProductoAdmin;
  precio: PrecioGrupo | undefined;
  onPrecio: (p: PrecioGrupo) => void;
}) {
  const { error, busy, run } = useUpload<PrecioGrupo>();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const path = `/admin/tiendas/${slug}/grupos/${grupo.slug}/productos/${producto.slug}/foto`;
  const propia = precio?.foto_url ?? null;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="file"
          accept={IMAGENES}
          aria-label={`Foto de ${producto.nombre} en ${grupo.nombre}`}
          tabIndex={-1}
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void run(path, { method: "POST", file }, onPrecio);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          aria-label={`${propia ? "Cambiar" : "Subir"} foto de ${producto.nombre}`}
        >
          <ImageUp aria-hidden="true" />
          {busy ? "Subiendo…" : propia ? "Cambiar" : "Subir foto"}
        </Button>
        {propia ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => run(path, { method: "DELETE" }, onPrecio)}
            aria-label={`Quitar la foto de ${producto.nombre} en ${grupo.nombre}`}
          >
            Quitar
          </Button>
        ) : null}
      </div>
      {error ? <FormMessage>{error}</FormMessage> : null}
    </div>
  );
}

function ProductosDelGrupo({
  slug,
  grupo,
  productos,
  precios,
  porDefecto,
  onPrecio,
  onDirty,
}: {
  slug: string;
  grupo: GrupoAdmin;
  productos: ProductoAdmin[];
  precios: PrecioGrupo[];
  porDefecto: boolean;
  onPrecio: (p: PrecioGrupo) => void;
  onDirty: (dirty: boolean) => void;
}) {
  const precioDe = (producto: string) =>
    precios.find((p) => p.grupo === grupo.slug && p.producto === producto);
  const [guardadas, setGuardadas] = React.useState<Record<string, Fila>>(() =>
    Object.fromEntries(
      productos.map((p) => [p.slug, filaInicial(precioDe(p.slug), porDefecto)]),
    ),
  );
  const [filas, setFilas] = React.useState(guardadas);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);
  const cambiadas = productos.filter(
    (p) =>
      filas[p.slug].precio !== guardadas[p.slug].precio ||
      filas[p.slug].suspendido !== guardadas[p.slug].suspendido,
  );

  React.useEffect(() => {
    onDirty(cambiadas.length > 0);
  }, [cambiadas.length, onDirty]);

  function set(producto: string, cambio: Partial<Fila>) {
    setMessage(null);
    setFilas((f) => ({ ...f, [producto]: { ...f[producto], ...cambio } }));
  }

  async function guardar() {
    setSaving(true);
    setMessage(null);
    const listas: Record<string, Fila> = {};
    try {
      for (const producto of cambiadas) {
        const fila = filas[producto.slug];
        onPrecio(
          await api<PrecioGrupo>(`/admin/tiendas/${slug}/precios`, {
            method: "PUT",
            body: {
              grupo: grupo.slug,
              producto: producto.slug,
              precio: fila.precio || null,
              disponible: !fila.suspendido,
            },
          }),
        );
        listas[producto.slug] = fila;
      }
      setMessage({ tone: "success", text: "Guardamos los cambios." });
    } catch (err) {
      setMessage({ tone: "error", text: errorMessage(err) });
    } finally {
      setGuardadas((g) => ({ ...g, ...listas }));
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-meta text-muted-foreground">
        Precio vacío = usa el precio base. Marcá{" "}
        <strong className="font-semibold">Suspendido</strong> si este colegio no
        usa esa prenda: deja de aparecer en su página.
      </p>
      <div
        role="table"
        aria-label={`Productos de ${grupo.nombre}`}
        className="flex flex-col divide-y divide-border rounded-card border border-border"
      >
        <div
          role="row"
          className="hidden gap-3 px-3 py-2 text-meta text-muted-foreground sm:grid sm:grid-cols-[3rem_minmax(0,1fr)_auto_9rem_7rem]"
        >
          <span role="columnheader" className="sr-only">
            Foto
          </span>
          <span role="columnheader" className="col-start-2">
            Producto
          </span>
          <span role="columnheader">Foto en este colegio</span>
          <span role="columnheader">Precio ($)</span>
          <span role="columnheader">Suspendido</span>
        </div>
        {productos.map((producto) => {
          const fila = filas[producto.slug];
          const precio = precioDe(producto.slug);
          const foto = precio?.foto_url ?? producto.foto_url;
          const id = `fila-${grupo.slug}-${producto.slug}`;
          return (
            <div
              key={producto.slug}
              role="row"
              className={cn(
                "grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-3 py-2 sm:grid-cols-[3rem_minmax(0,1fr)_auto_9rem_7rem]",
                fila.suspendido && "bg-muted/60",
              )}
            >
              <span
                role="cell"
                className="flex size-12 items-center justify-center overflow-hidden rounded-input border border-border bg-muted"
              >
                {foto ? (
                  // eslint-disable-next-line @next/next/no-img-element -- foto del bucket
                  <img src={foto} alt="" className="size-full object-contain" />
                ) : (
                  <span className="text-caption text-muted-foreground">—</span>
                )}
              </span>
              <span role="rowheader" className="flex min-w-0 flex-col">
                <span
                  className={cn(
                    "truncate font-semibold",
                    fila.suspendido && "text-muted-foreground line-through",
                  )}
                >
                  {producto.nombre}
                </span>
                <span className="text-caption text-muted-foreground">
                  {precio?.foto_url ? "Foto de este colegio" : "Foto general"}
                </span>
              </span>
              <span role="cell" className="col-span-2 sm:col-span-1">
                <FotoProducto
                  slug={slug}
                  grupo={grupo}
                  producto={producto}
                  precio={precio}
                  onPrecio={onPrecio}
                />
              </span>
              <span role="cell">
                <label htmlFor={`${id}-precio`} className="sr-only">
                  Precio de {producto.nombre}
                </label>
                <input
                  id={`${id}-precio`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={100}
                  placeholder={String(Number(producto.precio_base))}
                  value={fila.precio}
                  disabled={saving}
                  onChange={(e) =>
                    set(producto.slug, { precio: e.target.value })
                  }
                  className="h-11 w-full rounded-input border border-border bg-card px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </span>
              <span role="cell">
                <label className="flex min-h-11 items-center gap-2 text-base">
                  <input
                    type="checkbox"
                    checked={fila.suspendido}
                    aria-label={`Suspender ${producto.nombre}`}
                    disabled={saving}
                    onChange={(e) =>
                      set(producto.slug, { suspendido: e.target.checked })
                    }
                    className="size-5 accent-[var(--color-primary)]"
                  />
                  <span aria-hidden="true" className="sm:sr-only">
                    Suspendido
                  </span>
                </label>
              </span>
            </div>
          );
        })}
      </div>
      <div className="sticky bottom-0 flex flex-col gap-2 border-t border-border bg-card py-3 sm:flex-row sm:items-center">
        <Button
          type="button"
          variant="primary"
          disabled={saving || cambiadas.length === 0}
          onClick={guardar}
        >
          {saving
            ? "Guardando…"
            : cambiadas.length > 0
              ? `Guardar cambios (${cambiadas.length})`
              : "Guardar cambios"}
        </Button>
        {message ? (
          <FormMessage tone={message.tone}>{message.text}</FormMessage>
        ) : cambiadas.length > 0 ? (
          <p className="text-meta text-muted-foreground">
            Tenés cambios sin guardar.
          </p>
        ) : null}
      </div>
    </div>
  );
}

type Pestana = "datos" | "productos";

function EditarGrupo({
  tienda,
  grupo,
  productos,
  precios,
  onClose,
  onChange,
  onPrecio,
}: {
  tienda: TiendaAdmin;
  grupo: GrupoAdmin;
  productos: ProductoAdmin[];
  precios: PrecioGrupo[];
  onClose: () => void;
  onChange: (g: GrupoAdmin) => void;
  onPrecio: (p: PrecioGrupo) => void;
}) {
  const [pestana, setPestana] = React.useState<Pestana>("datos");
  const [dirty, setDirty] = React.useState(false);
  const pestanas: { id: Pestana; label: string }[] = [
    { id: "datos", label: "Datos y fotos" },
    ...(productos.length > 0
      ? [{ id: "productos" as const, label: "Productos y precios" }]
      : []),
  ];
  const base = `editar-${grupo.slug}`;

  function cerrar(open: boolean) {
    if (open) return;
    if (
      dirty &&
      !window.confirm("Tenés precios sin guardar. ¿Cerrar igual y perderlos?")
    ) {
      return;
    }
    onClose();
  }

  function teclas(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const i = pestanas.findIndex((p) => p.id === pestana);
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next = pestanas[(i + delta + pestanas.length) % pestanas.length];
    setPestana(next.id);
    document.getElementById(`${base}-tab-${next.id}`)?.focus();
  }

  return (
    <Dialog open onOpenChange={cerrar}>
      <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="flex-row items-center gap-3 border-b border-border p-4 pr-14">
          <GrupoLogo grupo={grupo} size="sm" />
          <div className="flex min-w-0 flex-col">
            <DialogTitle className="truncate">{grupo.nombre}</DialogTitle>
            <DialogDescription>
              {[grupo.subtitulo, grupo.categoria].filter(Boolean).join(" · ") ||
                `Editá este ${tienda.grupo_label.toLowerCase()}`}
            </DialogDescription>
          </div>
        </DialogHeader>
        <div
          role="tablist"
          aria-label="Secciones"
          onKeyDown={teclas}
          className="flex gap-1 border-b border-border px-4"
        >
          {pestanas.map((p) => (
            <button
              key={p.id}
              id={`${base}-tab-${p.id}`}
              type="button"
              role="tab"
              aria-selected={pestana === p.id}
              aria-controls={`${base}-panel-${p.id}`}
              tabIndex={pestana === p.id ? 0 : -1}
              onClick={() => setPestana(p.id)}
              className={cn(
                "-mb-px min-h-11 border-b-2 px-3 text-base font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                pestana === p.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="overflow-y-auto px-4 pt-4">
          <div
            role="tabpanel"
            id={`${base}-panel-datos`}
            aria-labelledby={`${base}-tab-datos`}
            hidden={pestana !== "datos"}
            className="flex flex-col gap-6 pb-4"
          >
            <GrupoForm
              tienda={tienda}
              idPrefix={grupo.slug}
              submitLabel="Guardar datos"
              initial={{
                nombre: grupo.nombre,
                subtitulo: grupo.subtitulo ?? "",
                categoria: grupo.categoria ?? "",
                color1: grupo.color1,
                color2: grupo.color2,
                activo: grupo.activo,
              }}
              onSubmit={async (draft) =>
                onChange(
                  await api<GrupoAdmin>(
                    `/admin/tiendas/${tienda.slug}/grupos/${grupo.slug}`,
                    { method: "PUT", body: toBody(draft) },
                  ),
                )
              }
            />
            <LogoUpload
              slug={tienda.slug}
              grupo={grupo}
              onUploaded={onChange}
            />
            <GaleriaGrupo
              slug={tienda.slug}
              grupo={grupo}
              onChange={onChange}
            />
          </div>
          {productos.length > 0 ? (
            <div
              role="tabpanel"
              id={`${base}-panel-productos`}
              aria-labelledby={`${base}-tab-productos`}
              hidden={pestana !== "productos"}
            >
              <ProductosDelGrupo
                slug={tienda.slug}
                grupo={grupo}
                productos={productos}
                precios={precios}
                porDefecto={tienda.productos_en_todos}
                onPrecio={onPrecio}
                onDirty={setDirty}
              />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const toBody = (d: Draft) => ({
  ...d,
  subtitulo: d.subtitulo.trim() || null,
  categoria: d.categoria || null,
});

export function GruposAdmin({
  tienda,
  grupos,
  productos = [],
  precios = [],
  onChange,
  onPrecio = () => {},
}: {
  tienda: TiendaAdmin;
  grupos: GrupoAdmin[];
  productos?: ProductoAdmin[];
  precios?: PrecioGrupo[];
  onChange: (grupos: GrupoAdmin[]) => void;
  onPrecio?: (precio: PrecioGrupo) => void;
}) {
  const [formKey, setFormKey] = React.useState(0);
  const [busqueda, setBusqueda] = React.useState("");
  const [abierto, setAbierto] = React.useState<string | null>(null);
  const visibles = filterGrupos(grupos, busqueda, null);
  const label = tienda.grupo_label.toLowerCase();
  const editando = grupos.find((g) => g.slug === abierto);
  const replace = (updated: GrupoAdmin) =>
    onChange(grupos.map((g) => (g.slug === updated.slug ? updated : g)));

  return (
    <div className="flex flex-col gap-8">
      <section
        aria-labelledby="nuevo-grupo"
        className="flex flex-col gap-3 rounded-card border border-border bg-card p-4"
      >
        <h3 id="nuevo-grupo" className="font-heading text-h3 font-semibold">
          Agregar {label}
        </h3>
        <GrupoForm
          key={formKey}
          tienda={tienda}
          idPrefix="nuevo"
          submitLabel={`Agregar ${label}`}
          initial={{
            nombre: "",
            subtitulo: "",
            categoria: "",
            color1: "#1E3A8A",
            color2: "#FFFFFF",
            activo: true,
          }}
          onSubmit={async (draft) => {
            const created = await api<GrupoAdmin>(
              `/admin/tiendas/${tienda.slug}/grupos`,
              { method: "POST", body: toBody(draft) },
            );
            onChange([...grupos, created]);
            setFormKey((k) => k + 1);
          }}
        />
      </section>

      <section aria-labelledby="lista-grupos" className="flex flex-col gap-3">
        <h3 id="lista-grupos" className="font-heading text-h3 font-semibold">
          {grupos.length} {grupos.length === 1 ? label : `${label}s`}
        </h3>
        {grupos.length > 0 ? (
          <div className="flex flex-col gap-1">
            <label htmlFor="buscar-grupo-admin" className="font-semibold">
              Buscar {label}
            </label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
              />
              <input
                id="buscar-grupo-admin"
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre o departamento"
                autoComplete="off"
                className="h-12 w-full rounded-input border border-border bg-card pl-10 pr-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            {busqueda.trim() ? (
              <p role="status" className="text-meta text-muted-foreground">
                {visibles.length === 0
                  ? `Ningún ${label} coincide con "${busqueda.trim()}".`
                  : `${visibles.length} de ${grupos.length}`}
              </p>
            ) : null}
          </div>
        ) : null}
        <ul className="flex flex-col gap-2">
          {visibles.map((grupo) => (
            <li key={grupo.slug}>
              <button
                type="button"
                onClick={() => setAbierto(grupo.slug)}
                className="flex min-h-14 w-full items-center gap-3 rounded-card border border-border bg-card p-3 text-left transition-colors duration-200 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <GrupoLogo grupo={grupo} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">{grupo.nombre}</span>
                  <span className="text-meta text-muted-foreground">
                    {[grupo.subtitulo, grupo.categoria]
                      .filter(Boolean)
                      .join(" · ")}
                    {grupo.activo ? "" : " · Oculto"}
                  </span>
                </span>
                <span className="text-meta font-semibold text-primary">
                  Editar
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      {editando ? (
        <EditarGrupo
          key={editando.slug}
          tienda={tienda}
          grupo={editando}
          productos={productos}
          precios={precios}
          onClose={() => setAbierto(null)}
          onChange={replace}
          onPrecio={onPrecio}
        />
      ) : null}
    </div>
  );
}
