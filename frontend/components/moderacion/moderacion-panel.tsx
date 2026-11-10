"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FormMessage,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import {
  type AvisoMod,
  ESTADOS_AVISO,
  type HistorialMod,
  puedeModerar,
  type UsuarioMod,
} from "@/lib/moderacion";
import { cn } from "@/lib/utils";

const BASE = "/admin/moderacion";
type Seccion = "avisos" | "usuarios" | "historial";

export function ModeracionPanel() {
  const { user } = useAuth();
  const [seccion, setSeccion] = React.useState<Seccion>("avisos");

  if (!puedeModerar(user?.role)) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-3 py-8">
        <h1 className="font-heading text-h1 font-semibold">Moderación</h1>
        <p className="text-muted-foreground">
          Esta sección es solo para administradores y moderadores.
        </p>
      </div>
    );
  }

  const secciones: { id: Seccion; label: string }[] = [
    { id: "avisos", label: "Avisos" },
    { id: "usuarios", label: "Usuarios" },
    { id: "historial", label: "Historial" },
  ];

  return (
    <div className="flex flex-col gap-6 py-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-h1 font-semibold">Moderación</h1>
        <p className="text-muted-foreground">
          Buscá avisos o usuarios para darlos de baja. El dueño del aviso ve el
          motivo y recibe un mail.
        </p>
      </header>
      <div role="group" aria-label="Sección" className="flex flex-wrap gap-2">
        {secciones.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={seccion === s.id}
            onClick={() => setSeccion(s.id)}
            className={cn(
              "inline-flex min-h-11 items-center rounded-pill border px-4 text-base transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              seccion === s.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:border-primary",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      <h2 className="sr-only">
        {secciones.find((s) => s.id === seccion)?.label}
      </h2>
      {seccion === "avisos" ? <AvisosMod /> : null}
      {seccion === "usuarios" ? <UsuariosMod /> : null}
      {seccion === "historial" ? <Historial /> : null}
    </div>
  );
}

/** Lista con búsqueda: recarga al enviar el formulario. */
function useBusqueda<T>(path: string, params: Record<string, string>) {
  const [items, setItems] = React.useState<T[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const key = JSON.stringify(params);

  React.useEffect(() => {
    let vivo = true;
    setError(null);
    const query = Object.fromEntries(
      Object.entries(JSON.parse(key) as Record<string, string>).filter(
        ([, v]) => v,
      ),
    );
    api<T[]>(path, { query })
      .then((data) => vivo && setItems(data))
      .catch((err) => vivo && setError(errorMessage(err)));
    return () => {
      vivo = false;
    };
  }, [path, key]);

  return { items, setItems, error };
}

function Buscador({
  id,
  label,
  placeholder,
  onBuscar,
  children,
}: {
  id: string;
  label: string;
  placeholder: string;
  onBuscar: (q: string) => void;
  children?: React.ReactNode;
}) {
  const [q, setQ] = React.useState("");
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onBuscar(q.trim());
      }}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <TextField
          id={id}
          label={label}
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {children}
      <Button type="submit" variant="primary">
        <Search aria-hidden="true" />
        Buscar
      </Button>
    </form>
  );
}

/** Botón que abre un campo de motivo antes de confirmar la baja. */
function AccionConMotivo({
  id,
  label,
  confirmar,
  onConfirm,
}: {
  id: string;
  label: string;
  confirmar: string;
  onConfirm: (motivo: string) => Promise<void>;
}) {
  const [abierto, setAbierto] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  if (!abierto) {
    return (
      <Button
        type="button"
        variant="destructive"
        onClick={() => setAbierto(true)}
      >
        {label}
      </Button>
    );
  }
  return (
    <form
      className="flex w-full flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (motivo.trim().length < 3) {
          setError("Escribí el motivo: lo ve el dueño.");
          return;
        }
        setBusy(true);
        setError(null);
        try {
          await onConfirm(motivo.trim());
        } catch (err) {
          setError(errorMessage(err));
          setBusy(false);
        }
      }}
    >
      <TextAreaField
        id={id}
        label="Motivo"
        hint="Lo ve el dueño. Ej.: precio engañoso, producto prohibido, estafa."
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        error={error}
        disabled={busy}
        maxLength={500}
        className="min-h-20"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="destructive" disabled={busy}>
          {busy ? "Guardando…" : confirmar}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setAbierto(false);
            setMotivo("");
            setError(null);
          }}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function AvisosMod() {
  const [params, setParams] = React.useState({ q: "", estado: "" });
  const [estado, setEstado] = React.useState("");
  const { items, setItems, error } = useBusqueda<AvisoMod>(
    `${BASE}/avisos`,
    params,
  );
  const reemplazar = (a: AvisoMod) =>
    setItems((prev) => prev?.map((x) => (x.id === a.id ? a : x)) ?? null);

  return (
    <div className="flex flex-col gap-4">
      <Buscador
        id="buscar-avisos"
        label="Buscar avisos"
        placeholder="Título, usuario o email del dueño"
        onBuscar={(q) => setParams({ q, estado })}
      >
        <SelectField
          id="estado-aviso"
          label="Estado"
          value={estado}
          onChange={(e) => {
            setEstado(e.target.value);
            setParams((p) => ({ ...p, estado: e.target.value }));
          }}
        >
          <option value="">Todos</option>
          {Object.entries(ESTADOS_AVISO).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </SelectField>
      </Buscador>
      {error ? <FormMessage>{error}</FormMessage> : null}
      {items === null ? (
        <p className="text-muted-foreground">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">No hay avisos que coincidan.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((a) => (
            <li
              key={a.id}
              className="flex flex-col gap-3 rounded-card border border-border bg-card p-4"
            >
              <div className="flex gap-3">
                {a.thumb_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- miniatura del bucket
                  <img
                    src={a.thumb_url}
                    alt=""
                    className="size-16 shrink-0 rounded-input object-cover"
                  />
                ) : null}
                <div className="flex min-w-0 flex-col gap-1">
                  <h3 className="font-semibold">
                    {a.status === "active" ? (
                      <Link
                        href={a.url_path}
                        className="underline-offset-4 hover:underline"
                      >
                        {a.title}
                      </Link>
                    ) : (
                      a.title
                    )}
                  </h3>
                  <p className="text-meta text-muted-foreground">
                    {formatPrice(a.price, a.price_currency)} · publicado el{" "}
                    {formatDate(a.created_at)}
                  </p>
                  <p className="text-meta text-muted-foreground">
                    De {a.dueno.display_name} (@{a.dueno.username}
                    {a.dueno.email ? ` · ${a.dueno.email}` : ""})
                    {a.dueno.is_active ? "" : " · cuenta suspendida"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      tone={a.status === "suspended" ? "danger" : "neutral"}
                    >
                      {ESTADOS_AVISO[a.status] ?? a.status}
                    </Badge>
                    {a.moderation_reason ? (
                      <span className="text-meta">
                        Motivo: {a.moderation_reason}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              {a.status === "suspended" ? (
                <Restaurar
                  label={`Restaurar aviso ${a.title}`}
                  onClick={async () =>
                    reemplazar(
                      await api<AvisoMod>(`${BASE}/avisos/${a.id}/restaurar`, {
                        method: "POST",
                      }),
                    )
                  }
                >
                  Restaurar aviso
                </Restaurar>
              ) : (
                <AccionConMotivo
                  id={`motivo-aviso-${a.id}`}
                  label="Dar de baja"
                  confirmar="Confirmar baja del aviso"
                  onConfirm={async (motivo) =>
                    reemplazar(
                      await api<AvisoMod>(`${BASE}/avisos/${a.id}/suspender`, {
                        method: "POST",
                        body: { motivo },
                      }),
                    )
                  }
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Restaurar({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        aria-label={label}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await onClick();
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        {children}
      </Button>
      {error ? <FormMessage>{error}</FormMessage> : null}
    </div>
  );
}

function UsuariosMod() {
  const [params, setParams] = React.useState({ q: "" });
  const { items, setItems, error } = useBusqueda<UsuarioMod>(
    `${BASE}/usuarios`,
    params,
  );
  const reemplazar = (u: UsuarioMod) =>
    setItems((prev) => prev?.map((x) => (x.id === u.id ? u : x)) ?? null);

  return (
    <div className="flex flex-col gap-4">
      <Buscador
        id="buscar-usuarios"
        label="Buscar usuarios"
        placeholder="Usuario, nombre o email"
        onBuscar={(q) => setParams({ q })}
      />
      {error ? <FormMessage>{error}</FormMessage> : null}
      {items === null ? (
        <p className="text-muted-foreground">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">No hay usuarios que coincidan.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((u) => {
            const protegido = u.role === "admin" || u.role === "moderator";
            return (
              <li
                key={u.id}
                className="flex flex-col gap-3 rounded-card border border-border bg-card p-4"
              >
                <div className="flex flex-col gap-1">
                  <h3 className="font-semibold">
                    <Link
                      href={`/u/${u.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {u.display_name}
                    </Link>{" "}
                    <span className="font-normal text-muted-foreground">
                      @{u.username}
                    </span>
                  </h3>
                  <p className="text-meta text-muted-foreground">
                    {u.email ?? "Sin email"} · {u.avisos_activos}{" "}
                    {u.avisos_activos === 1 ? "aviso activo" : "avisos activos"}{" "}
                    · desde {formatDate(u.created_at)}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {u.is_active ? (
                      <Badge tone="success">Activo</Badge>
                    ) : (
                      <Badge tone="danger">Suspendido</Badge>
                    )}
                    {protegido ? (
                      <Badge tone="info">
                        {u.role === "admin" ? "Administrador" : "Moderador"}
                      </Badge>
                    ) : null}
                    {u.suspension_reason ? (
                      <span className="text-meta">
                        Motivo: {u.suspension_reason}
                      </span>
                    ) : null}
                  </div>
                </div>
                {protegido ? null : u.is_active ? (
                  <AccionConMotivo
                    id={`motivo-usuario-${u.id}`}
                    label="Suspender usuario"
                    confirmar="Confirmar suspensión"
                    onConfirm={async (motivo) =>
                      reemplazar(
                        await api<UsuarioMod>(
                          `${BASE}/usuarios/${u.id}/suspender`,
                          { method: "POST", body: { motivo } },
                        ),
                      )
                    }
                  />
                ) : (
                  <Restaurar
                    label={`Reactivar a ${u.username}`}
                    onClick={async () =>
                      reemplazar(
                        await api<UsuarioMod>(
                          `${BASE}/usuarios/${u.id}/reactivar`,
                          { method: "POST" },
                        ),
                      )
                    }
                  >
                    Reactivar usuario
                  </Restaurar>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Historial() {
  const { items, error } = useBusqueda<HistorialMod>(`${BASE}/historial`, {});
  if (error) return <FormMessage>{error}</FormMessage>;
  if (items === null) return <p className="text-muted-foreground">Cargando…</p>;
  if (items.length === 0) {
    return <p className="text-muted-foreground">Todavía no hubo acciones.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-card">
      {items.map((h) => (
        <li key={h.id} className="flex flex-col gap-0.5 p-3">
          <p>
            <span className="font-semibold">
              {h.action === "suspend" ? "Baja" : "Restauración"}
            </span>{" "}
            de {h.target_type === "listing" ? "aviso" : "usuario"}{" "}
            <span className="font-semibold">{h.target_label}</span>
          </p>
          <p className="text-meta text-muted-foreground">
            {formatDate(h.created_at)} · por {h.actor ?? "—"}
            {h.reason ? ` · Motivo: ${h.reason}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
