"use client";

import { MessageCircle } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";

export interface ConsultaTienda {
  id: string;
  grupo: string | null;
  nombre: string;
  telefono: string;
  mensaje: string | null;
  estado: "nueva" | "respondida";
  created_at: string;
}

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
  });

/** Consultas de clientes, como colegios que todavía no están cargados. */
export function ConsultasAdmin({
  slug,
  grupoLabel,
}: {
  slug: string;
  grupoLabel: string;
}) {
  const [lista, setLista] = React.useState<ConsultaTienda[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const path = `/admin/tiendas/${encodeURIComponent(slug)}/consultas`;

  React.useEffect(() => {
    api<ConsultaTienda[]>(path)
      .then(setLista)
      .catch((err) => setError(errorMessage(err)));
  }, [path]);

  async function marcar(c: ConsultaTienda) {
    try {
      const nueva = await api<ConsultaTienda>(`${path}/${c.id}`, {
        method: "PUT",
        body: { estado: c.estado === "nueva" ? "respondida" : "nueva" },
      });
      setLista((l) => l?.map((x) => (x.id === c.id ? nueva : x)) ?? null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const label = grupoLabel.toLowerCase();
  return (
    <section aria-labelledby="consultas-tienda" className="flex flex-col gap-3">
      <h2 id="consultas-tienda" className="font-heading text-h2 font-semibold">
        Consultas
      </h2>
      <p className="text-meta text-muted-foreground">
        Gente que preguntó por un {label} que no está cargado (u otras dudas).
        También te llegan por email.
      </p>
      {error ? <FormMessage>{error}</FormMessage> : null}
      {lista === null && !error ? <Skeleton className="h-24 w-full" /> : null}
      {lista?.length === 0 ? (
        <p className="text-muted-foreground">Todavía no hay consultas.</p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {lista?.map((c) => (
          <li
            key={c.id}
            className="flex flex-col gap-2 rounded-card border border-border bg-card p-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold">
                {c.grupo ?? "Consulta general"}
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
              {c.nombre} · {c.telefono}
            </p>
            {c.mensaje ? <p>{c.mensaje}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="whatsapp">
                <a
                  href={`https://wa.me/${c.telefono.replace(/\D/g, "")}`}
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
                onClick={() => void marcar(c)}
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
