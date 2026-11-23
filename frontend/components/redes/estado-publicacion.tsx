"use client";

import { ExternalLink, RotateCcw } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import { ESTADO_LABEL, fechaHora, type Publicacion, REDES } from "@/lib/redes";
import { cn } from "@/lib/utils";

/** Una publicación: red, estado, link al post o el error con "Reintentar". */
export function EstadoPublicacion({
  publicacion,
  onChange,
  titulo,
}: {
  publicacion: Publicacion;
  onChange: (p: Publicacion) => void;
  titulo?: React.ReactNode;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const red = REDES.find((r) => r.id === publicacion.red)?.nombre;

  async function reintentar() {
    setSaving(true);
    setError(null);
    try {
      onChange(
        await api<Publicacion>(`/admin/redes/${publicacion.id}/reintentar`, {
          method: "POST",
        }),
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="flex flex-col gap-1 rounded-input border border-border p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold">{red}</span>
        <span
          className={cn(
            "rounded-pill px-2 py-0.5 text-meta font-semibold",
            publicacion.estado === "publicada" && "bg-success text-white",
            publicacion.estado === "error" && "bg-destructive text-white",
            publicacion.estado === "pendiente" && "bg-muted text-foreground",
          )}
        >
          {ESTADO_LABEL[publicacion.estado]}
        </span>
        <span className="text-meta text-muted-foreground">
          {fechaHora(publicacion.publicada_at ?? publicacion.created_at)}
        </span>
        {titulo}
      </div>
      {publicacion.permalink ? (
        <a
          href={publicacion.permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-9 items-center gap-1 self-start font-semibold text-primary underline-offset-4 hover:underline"
        >
          Ver la publicación
          <ExternalLink aria-hidden="true" className="size-4" />
        </a>
      ) : null}
      {publicacion.estado === "error" ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-meta text-destructive">{publicacion.error}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void reintentar()}
            disabled={saving}
          >
            <RotateCcw aria-hidden="true" />
            {saving ? "Reintentando…" : "Reintentar"}
          </Button>
        </div>
      ) : null}
      {error ? <FormMessage>{error}</FormMessage> : null}
    </li>
  );
}
