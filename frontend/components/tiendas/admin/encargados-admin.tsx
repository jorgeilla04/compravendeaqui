"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { FormMessage, TextField } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import type { Encargado } from "@/lib/tiendas/types";

/** Quién administra la tienda (solo lo ven los administradores del sitio). */
export function EncargadosAdmin({ slug }: { slug: string }) {
  const [encargados, setEncargados] = React.useState<Encargado[] | null>(null);
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const path = `/admin/tiendas/${slug}/encargados`;

  React.useEffect(() => {
    api<Encargado[]>(path)
      .then(setEncargados)
      .catch((err) => setError(errorMessage(err)));
  }, [path]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const added = await api<Encargado>(path, {
        method: "POST",
        body: { email: email.trim() },
      });
      setEncargados((list) => [
        ...(list ?? []).filter((e) => e.id !== added.id),
        added,
      ]);
      setEmail("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function quitar(target: Encargado) {
    setError(null);
    try {
      await api(`${path}/${encodeURIComponent(target.id)}`, {
        method: "DELETE",
      });
      setEncargados((list) => list?.filter((e) => e.id !== target.id) ?? null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-prose text-muted-foreground">
        Los encargados manejan esta tienda desde su cuenta: pedidos, catálogo,
        precios y configuración. Tienen que haber ingresado al sitio una vez.
      </p>
      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <TextField
          id="encargado-email"
          label="Email del encargado"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={saving}
          className="sm:min-w-80"
        />
        <Button type="submit" variant="primary" disabled={saving || !email}>
          Agregar encargado
        </Button>
      </form>
      {error ? <FormMessage>{error}</FormMessage> : null}
      <ul className="flex flex-col gap-2">
        {encargados?.length === 0 ? (
          <li className="text-muted-foreground">Todavía no hay encargados.</li>
        ) : null}
        {encargados?.map((e) => (
          <li
            key={e.id}
            className="flex items-center justify-between gap-3 rounded-card border border-border bg-card p-3"
          >
            <span>
              <span className="font-semibold">{e.nombre}</span>
              <span className="block text-meta text-muted-foreground">
                {e.email}
              </span>
            </span>
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => quitar(e)}
              aria-label={`Quitar a ${e.nombre}`}
            >
              Quitar
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
