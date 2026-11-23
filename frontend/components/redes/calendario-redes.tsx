"use client";

import { ExternalLink, Plus, Shirt, Tag, Trash2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { api, buildUrl, errorMessage } from "@/lib/api";
import {
  diaISO,
  diaLargo,
  ESTADO_PROGRAMACION,
  horaSanJuan,
  MAX_POR_DIA,
  type Programacion,
  type Red,
  REDES,
} from "@/lib/redes";
import type { GrupoDetalle, Tienda } from "@/lib/tiendas/types";
import type { ListingPage } from "@/lib/types";
import { cn } from "@/lib/utils";

const DIAS = 31;
const TIENDA = "uniformes";

type Conectadas = Record<Red, boolean>;

/**
 * Calendario de publicaciones (solo administradores): los próximos 31 días,
 * desde mañana. Cada día admite hasta 3 productos (prenda de un colegio o
 * aviso); cada uno sale en su propio post a una hora fija.
 */
export function CalendarioRedes({ hoy = new Date() }: { hoy?: Date }) {
  const { user } = useAuth();
  const desde = diaISO(1, hoy);
  const [lista, setLista] = React.useState<Programacion[] | null>(null);
  const [conectadas, setConectadas] = React.useState<Conectadas | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [abierto, setAbierto] = React.useState<string | null>(null);

  const cargar = React.useCallback(
    () =>
      api<Programacion[]>("/admin/redes/calendario", {
        query: { desde, dias: DIAS },
      })
        .then(setLista)
        .catch((err) => setError(errorMessage(err))),
    [desde],
  );

  React.useEffect(() => {
    if (user?.role !== "admin") return;
    void cargar();
    api<Conectadas>("/admin/redes/estado")
      .then(setConectadas)
      .catch(() => undefined);
  }, [user?.role, cargar]);

  if (user && user.role !== "admin") {
    return (
      <FormMessage>Esta sección es solo para administradores.</FormMessage>
    );
  }

  const dias = Array.from({ length: DIAS }, (_, i) => diaISO(i + 1, hoy));
  const porDia = new Map<string, Programacion[]>();
  for (const p of lista ?? []) {
    porDia.set(p.fecha, [...(porDia.get(p.fecha) ?? []), p]);
  }
  const total = lista?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <nav
          aria-label="Migas de pan"
          className="text-meta text-muted-foreground"
        >
          <Link
            href="/admin/redes"
            className="underline underline-offset-4 hover:text-primary"
          >
            Redes sociales
          </Link>{" "}
          / <span aria-current="page">Calendario</span>
        </nav>
        <h1 className="font-heading text-h1 font-semibold">
          Calendario de publicaciones
        </h1>
        <p className="max-w-prose text-muted-foreground">
          Hasta {MAX_POR_DIA} productos por día, cada uno en su propio post.
          Salen solos a las 19 h (si hay uno), 12 y 19 h (dos) o 10, 14 y 19 h
          (tres).
        </p>
        {lista ? (
          <p className="text-meta">
            <strong>{total}</strong>{" "}
            {total === 1
              ? "publicación programada"
              : "publicaciones programadas"}{" "}
            en los próximos {DIAS} días.
          </p>
        ) : null}
      </div>
      {error ? <FormMessage>{error}</FormMessage> : null}
      {lista === null && !error ? <Skeleton className="h-64 w-full" /> : null}
      {lista ? (
        <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {dias.map((dia) => {
            const items = porDia.get(dia) ?? [];
            const lleno = items.length >= MAX_POR_DIA;
            return (
              <li
                key={dia}
                aria-label={diaLargo(dia)}
                className="flex flex-col gap-2 rounded-card border border-border bg-card p-3"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-semibold">{diaLargo(dia)}</h2>
                  <span className="text-meta text-muted-foreground">
                    {items.length}/{MAX_POR_DIA}
                  </span>
                </div>
                {items.length > 0 ? (
                  <ul className="flex flex-col gap-2">
                    {items.map((p) => (
                      <ItemProgramado
                        key={p.id}
                        programacion={p}
                        onQuitado={() => void cargar()}
                      />
                    ))}
                  </ul>
                ) : null}
                {abierto === dia ? (
                  <AgregarAlDia
                    fecha={dia}
                    conectadas={conectadas}
                    onCancelar={() => setAbierto(null)}
                    onAgregado={() => {
                      setAbierto(null);
                      void cargar();
                    }}
                  />
                ) : !lleno ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-start"
                    onClick={() => setAbierto(dia)}
                    aria-label={`Agregar producto el ${diaLargo(dia)}`}
                  >
                    <Plus aria-hidden="true" />
                    Agregar
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}

function ItemProgramado({
  programacion: p,
  onQuitado,
}: {
  programacion: Programacion;
  onQuitado: () => void;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const link = p.publicaciones.find((x) => x.permalink)?.permalink;

  async function quitar() {
    if (!window.confirm(`¿Sacar «${p.titulo}» del calendario?`)) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/admin/redes/calendario/${p.id}`, { method: "DELETE" });
      onQuitado();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  const Icono = p.tipo === "uniforme" ? Shirt : Tag;
  return (
    <li className="flex gap-3 rounded-input border border-border p-2">
      {p.vista_previa ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagen armada por la API
        <img
          src={buildUrl(p.vista_previa)}
          alt=""
          loading="lazy"
          className="size-16 shrink-0 rounded-input border border-border bg-muted object-cover"
        />
      ) : (
        <span className="flex size-16 shrink-0 items-center justify-center rounded-input bg-muted">
          <Icono aria-hidden="true" className="size-6 text-muted-foreground" />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="line-clamp-2 text-meta font-semibold">{p.titulo}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta">
          <span className="font-semibold">{horaSanJuan(p.publicar_at)} h</span>
          <span
            className={cn(
              "rounded-pill px-2 py-0.5 font-semibold",
              p.estado === "publicada" && "bg-success text-white",
              p.estado === "error" && "bg-destructive text-white",
              (p.estado === "programada" || p.estado === "publicando") &&
                "bg-muted text-foreground",
            )}
          >
            {ESTADO_PROGRAMACION[p.estado]}
          </span>
          <span className="text-muted-foreground">
            {p.redes
              .map((r) => REDES.find((x) => x.id === r)?.nombre ?? r)
              .join(" y ")}
          </span>
        </div>
        {p.estado === "error" && p.error ? (
          <p className="text-meta text-destructive">{p.error}</p>
        ) : null}
        {error ? <FormMessage>{error}</FormMessage> : null}
        <div className="flex flex-wrap gap-2">
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-9 items-center gap-1 text-meta font-semibold text-primary underline-offset-4 hover:underline"
            >
              Ver la publicación
              <ExternalLink aria-hidden="true" className="size-4" />
            </a>
          ) : null}
          {p.estado === "programada" ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => void quitar()}
              disabled={saving}
              aria-label={`Sacar ${p.titulo} del calendario`}
            >
              <Trash2 aria-hidden="true" />
              Sacar
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

type Tipo = "uniforme" | "aviso";

function AgregarAlDia({
  fecha,
  conectadas,
  onCancelar,
  onAgregado,
}: {
  fecha: string;
  conectadas: Conectadas | null;
  onCancelar: () => void;
  onAgregado: () => void;
}) {
  const [tipo, setTipo] = React.useState<Tipo>("uniforme");
  const [tienda, setTienda] = React.useState<Tienda | null>(null);
  const [grupo, setGrupo] = React.useState("");
  const [detalle, setDetalle] = React.useState<GrupoDetalle | null>(null);
  const [producto, setProducto] = React.useState("");
  const [busqueda, setBusqueda] = React.useState("");
  const [avisos, setAvisos] = React.useState<ListingPage["items"]>([]);
  const [aviso, setAviso] = React.useState<{
    id: string;
    title: string;
  } | null>(null);
  const [elegidas, setElegidas] = React.useState<Red[]>(["facebook"]);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const id = `agregar-${fecha}`;

  React.useEffect(() => {
    if (tipo !== "uniforme" || tienda) return;
    api<Tienda>(`/tiendas/${TIENDA}`)
      .then(setTienda)
      .catch((err) => setError(errorMessage(err)));
  }, [tipo, tienda]);

  React.useEffect(() => {
    setDetalle(null);
    setProducto("");
    if (!grupo) return;
    api<GrupoDetalle>(`/tiendas/${TIENDA}/grupos/${encodeURIComponent(grupo)}`)
      .then((d) => {
        setDetalle(d);
        setProducto(d.productos[0]?.slug ?? "");
      })
      .catch((err) => setError(errorMessage(err)));
  }, [grupo]);

  React.useEffect(() => {
    if (tipo !== "aviso" || busqueda.trim().length < 2) {
      setAvisos([]);
      return;
    }
    const timer = window.setTimeout(() => {
      api<ListingPage>("/listings", {
        query: { q: busqueda.trim(), limit: 8 },
      })
        .then((r) => setAvisos(r.items))
        .catch(() => setAvisos([]));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [tipo, busqueda]);

  const listo =
    elegidas.length > 0 &&
    (tipo === "uniforme" ? Boolean(grupo && producto) : Boolean(aviso));

  async function programar() {
    setSaving(true);
    setError(null);
    try {
      await api("/admin/redes/calendario", {
        method: "POST",
        body:
          tipo === "uniforme"
            ? { fecha, redes: elegidas, tienda: TIENDA, grupo, producto }
            : { fecha, redes: elegidas, listing_id: aviso?.id },
      });
      onAgregado();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  const alternar = (red: Red) =>
    setElegidas((xs) =>
      xs.includes(red) ? xs.filter((x) => x !== red) : [...xs, red],
    );

  return (
    <div
      role="group"
      aria-label={`Agregar producto el ${diaLargo(fecha)}`}
      className="flex flex-col gap-3 rounded-input border border-dashed border-primary p-3"
    >
      <div role="group" aria-label="Qué publicar" className="flex gap-2">
        {(
          [
            ["uniforme", "Uniforme"],
            ["aviso", "Aviso"],
          ] as const
        ).map(([valor, label]) => (
          <button
            key={valor}
            type="button"
            aria-pressed={tipo === valor}
            onClick={() => setTipo(valor)}
            className={cn(
              "min-h-9 rounded-pill border px-3 text-meta font-semibold",
              tipo === valor
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:border-primary",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tipo === "uniforme" ? (
        <>
          <label className="flex flex-col gap-1 text-meta font-semibold">
            Colegio
            <select
              value={grupo}
              onChange={(e) => setGrupo(e.target.value)}
              className="min-h-11 rounded-input border border-border bg-card px-3 text-base font-normal"
            >
              <option value="">
                {tienda ? "Elegí un colegio" : "Cargando…"}
              </option>
              {tienda?.grupos.map((g) => (
                <option key={g.slug} value={g.slug}>
                  {g.nombre}
                </option>
              ))}
            </select>
          </label>
          {grupo ? (
            <label className="flex flex-col gap-1 text-meta font-semibold">
              Prenda
              <select
                value={producto}
                onChange={(e) => setProducto(e.target.value)}
                disabled={!detalle}
                className="min-h-11 rounded-input border border-border bg-card px-3 text-base font-normal"
              >
                {detalle ? null : <option value="">Cargando…</option>}
                {detalle?.productos.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-buscar`} className="text-meta font-semibold">
            Buscar aviso
          </label>
          <input
            id={`${id}-buscar`}
            type="search"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setAviso(null);
            }}
            placeholder="Ej.: heladera"
            className="min-h-11 rounded-input border border-border bg-card px-3"
          />
          {aviso ? (
            <p className="text-meta">
              Elegido: <strong>{aviso.title}</strong>
            </p>
          ) : avisos.length > 0 ? (
            <ul className="flex flex-col gap-1" aria-label="Avisos encontrados">
              {avisos.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => setAviso({ id: a.id, title: a.title })}
                    className="min-h-9 w-full rounded-input px-2 text-left text-meta hover:bg-muted"
                  >
                    {a.title}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <legend className="sr-only">Dónde publicar</legend>
        {REDES.map((r) => (
          <label
            key={r.id}
            className={cn(
              "flex min-h-11 items-center gap-2",
              conectadas && !conectadas[r.id] && "text-muted-foreground",
            )}
          >
            <input
              type="checkbox"
              className="size-5"
              checked={elegidas.includes(r.id)}
              disabled={Boolean(conectadas && !conectadas[r.id]) || saving}
              onChange={() => alternar(r.id)}
            />
            {r.nombre}
          </label>
        ))}
      </fieldset>
      {error ? <FormMessage>{error}</FormMessage> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="accent"
          size="sm"
          onClick={() => void programar()}
          disabled={!listo || saving}
        >
          {saving ? "Programando…" : "Programar"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
