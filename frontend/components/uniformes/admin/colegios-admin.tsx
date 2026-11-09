"use client";

import * as React from "react";

import { Escudo } from "@/components/uniformes/escudo";
import { Button } from "@/components/ui/button";
import { FormMessage, SelectField, TextField } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import type { CategoriaSlug, ColegioAdmin } from "@/lib/uniformes/types";

export const CATEGORIAS: { slug: CategoriaSlug; nombre: string }[] = [
  { slug: "parroquiales", nombre: "Parroquiales y confesionales" },
  { slug: "privados", nombre: "Privados laicos y bilingües" },
  { slug: "preuniversitarios", nombre: "Preuniversitarios (UNSJ)" },
];

interface Draft {
  nombre: string;
  departamento: string;
  categoria: CategoriaSlug;
  color1: string;
  color2: string;
  activo: boolean;
}

function ColegioForm({
  initial,
  submitLabel,
  onSubmit,
  idPrefix,
}: {
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
    if (
      draft.nombre.trim().length < 3 ||
      draft.departamento.trim().length < 2
    ) {
      setMessage({
        tone: "error",
        text: "Completá el nombre y el departamento.",
      });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await onSubmit({
        ...draft,
        nombre: draft.nombre.trim(),
        departamento: draft.departamento.trim(),
      });
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
        label="Nombre del colegio"
        value={draft.nombre}
        onChange={(e) => set("nombre", e.target.value)}
        disabled={saving}
        required
      />
      <TextField
        id={`${idPrefix}-departamento`}
        label="Departamento"
        value={draft.departamento}
        onChange={(e) => set("departamento", e.target.value)}
        disabled={saving}
        required
      />
      <SelectField
        id={`${idPrefix}-categoria`}
        label="Categoría"
        value={draft.categoria}
        onChange={(e) => set("categoria", e.target.value as CategoriaSlug)}
        disabled={saving}
      >
        {CATEGORIAS.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.nombre}
          </option>
        ))}
      </SelectField>
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
  colegio,
  onUploaded,
}: {
  colegio: ColegioAdmin;
  onUploaded: (c: ColegioAdmin) => void;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const id = `logo-${colegio.slug}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-meta font-semibold">
        Escudo oficial (con autorización del colegio)
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
              await api<ColegioAdmin>(
                `/admin/uniformes/colegios/${colegio.slug}/logo`,
                {
                  method: "POST",
                  body: form,
                },
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

export function ColegiosAdmin({
  colegios,
  onChange,
}: {
  colegios: ColegioAdmin[];
  onChange: (colegios: ColegioAdmin[]) => void;
}) {
  const [formKey, setFormKey] = React.useState(0);
  const replace = (updated: ColegioAdmin) =>
    onChange(colegios.map((c) => (c.slug === updated.slug ? updated : c)));

  return (
    <div className="flex flex-col gap-8">
      <section
        aria-labelledby="nuevo-colegio"
        className="flex flex-col gap-3 rounded-card border border-border bg-card p-4"
      >
        <h3 id="nuevo-colegio" className="font-heading text-h3 font-semibold">
          Agregar colegio
        </h3>
        <ColegioForm
          key={formKey}
          idPrefix="nuevo"
          submitLabel="Agregar colegio"
          initial={{
            nombre: "",
            departamento: "Capital",
            categoria: "parroquiales",
            color1: "#1E3A8A",
            color2: "#FFFFFF",
            activo: true,
          }}
          onSubmit={async (draft) => {
            const created = await api<ColegioAdmin>(
              "/admin/uniformes/colegios",
              {
                method: "POST",
                body: draft,
              },
            );
            onChange([...colegios, created]);
            setFormKey((k) => k + 1);
          }}
        />
      </section>

      <section aria-labelledby="lista-colegios" className="flex flex-col gap-3">
        <h3 id="lista-colegios" className="font-heading text-h3 font-semibold">
          {colegios.length} {colegios.length === 1 ? "colegio" : "colegios"}
        </h3>
        <ul className="flex flex-col gap-3">
          {colegios.map((colegio) => (
            <li key={colegio.slug}>
              <details className="rounded-card border border-border bg-card">
                <summary className="flex min-h-14 cursor-pointer items-center gap-3 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Escudo colegio={colegio} size="sm" />
                  <span className="flex flex-col">
                    <span className="font-semibold">{colegio.nombre}</span>
                    <span className="text-meta text-muted-foreground">
                      {colegio.departamento}
                      {colegio.activo ? "" : " · Oculto"}
                    </span>
                  </span>
                </summary>
                <div className="flex flex-col gap-4 border-t border-border p-3">
                  <ColegioForm
                    idPrefix={colegio.slug}
                    submitLabel="Guardar cambios"
                    initial={{
                      nombre: colegio.nombre,
                      departamento: colegio.departamento,
                      categoria: colegio.categoria,
                      color1: colegio.color1,
                      color2: colegio.color2,
                      activo: colegio.activo,
                    }}
                    onSubmit={async (draft) =>
                      replace(
                        await api<ColegioAdmin>(
                          `/admin/uniformes/colegios/${colegio.slug}`,
                          {
                            method: "PUT",
                            body: draft,
                          },
                        ),
                      )
                    }
                  />
                  <LogoUpload colegio={colegio} onUploaded={replace} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
