"use client";

import * as React from "react";

import { GrupoLogo } from "@/components/tiendas/grupo-logo";
import { Button } from "@/components/ui/button";
import { FormMessage, SelectField, TextField } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import type { GrupoAdmin, TiendaAdmin } from "@/lib/tiendas/types";

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
        Logo o escudo oficial (con autorización)
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

export function GruposAdmin({
  tienda,
  grupos,
  onChange,
}: {
  tienda: TiendaAdmin;
  grupos: GrupoAdmin[];
  onChange: (grupos: GrupoAdmin[]) => void;
}) {
  const [formKey, setFormKey] = React.useState(0);
  const label = tienda.grupo_label.toLowerCase();
  const replace = (updated: GrupoAdmin) =>
    onChange(grupos.map((g) => (g.slug === updated.slug ? updated : g)));
  const toBody = (d: Draft) => ({
    ...d,
    subtitulo: d.subtitulo.trim() || null,
    categoria: d.categoria || null,
  });

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
        <ul className="flex flex-col gap-3">
          {grupos.map((grupo) => (
            <li key={grupo.slug}>
              <details className="rounded-card border border-border bg-card">
                <summary className="flex min-h-14 cursor-pointer items-center gap-3 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <GrupoLogo grupo={grupo} size="sm" />
                  <span className="flex flex-col">
                    <span className="font-semibold">{grupo.nombre}</span>
                    <span className="text-meta text-muted-foreground">
                      {[grupo.subtitulo, grupo.categoria]
                        .filter(Boolean)
                        .join(" · ")}
                      {grupo.activo ? "" : " · Oculto"}
                    </span>
                  </span>
                </summary>
                <div className="flex flex-col gap-4 border-t border-border p-3">
                  <GrupoForm
                    tienda={tienda}
                    idPrefix={grupo.slug}
                    submitLabel="Guardar cambios"
                    initial={{
                      nombre: grupo.nombre,
                      subtitulo: grupo.subtitulo ?? "",
                      categoria: grupo.categoria ?? "",
                      color1: grupo.color1,
                      color2: grupo.color2,
                      activo: grupo.activo,
                    }}
                    onSubmit={async (draft) =>
                      replace(
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
                    onUploaded={replace}
                  />
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
