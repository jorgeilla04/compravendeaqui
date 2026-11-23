"use client";

import { Share2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { useOptionalAuth } from "@/components/auth/auth-provider";
import { EstadoPublicacion } from "@/components/redes/estado-publicacion";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { api, buildUrl, errorMessage } from "@/lib/api";
import { type AvisoRedes, type Red, REDES } from "@/lib/redes";
import { cn } from "@/lib/utils";

const ESPERA_MS = 3000;

/**
 * "Publicar en redes" (solo administradores): vista previa de la imagen y el
 * texto, elegir Facebook y/o Instagram, y seguir el estado de cada post.
 * Sirve para un aviso (`listingId`) o para cualquier ruta de la API de redes
 * (`path`, ej.: un producto de un colegio); `selector` va arriba de la vista
 * previa (ej.: elegir la prenda).
 */
export function PublicarEnRedes({
  listingId,
  path: ruta,
  selector,
}: {
  listingId?: string;
  path?: string;
  selector?: React.ReactNode;
}) {
  const esAdmin = useOptionalAuth()?.user?.role === "admin";
  const [datos, setDatos] = React.useState<AvisoRedes | null>(null);
  const [elegidas, setElegidas] = React.useState<Red[]>([]);
  const [verTexto, setVerTexto] = React.useState<Red>("facebook");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [version, setVersion] = React.useState(0);
  const path = ruta ?? `/admin/redes/avisos/${listingId}`;

  const cargar = React.useCallback(
    () =>
      api<AvisoRedes>(path)
        .then((d) => {
          setDatos(d);
          return d;
        })
        .catch((err) => {
          setError(errorMessage(err));
          return null;
        }),
    [path],
  );

  React.useEffect(() => {
    if (!esAdmin) return;
    setDatos(null);
    setError(null);
    setElegidas([]);
    void cargar();
  }, [esAdmin, cargar]);

  // Mientras haya publicaciones en curso, se consulta el estado.
  const pendientes = datos?.publicaciones.some((p) => p.estado === "pendiente");
  React.useEffect(() => {
    if (!pendientes) return;
    const timer = window.setTimeout(() => void cargar(), ESPERA_MS);
    return () => window.clearTimeout(timer);
  }, [pendientes, datos, cargar]);

  if (!esAdmin) return null;

  async function publicar() {
    setSaving(true);
    setError(null);
    try {
      await api(path, { method: "POST", body: { redes: elegidas } });
      setElegidas([]);
      await cargar();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const alternar = (red: Red) =>
    setElegidas((xs) =>
      xs.includes(red) ? xs.filter((x) => x !== red) : [...xs, red],
    );

  return (
    <section
      aria-labelledby="redes-titulo"
      className="flex flex-col gap-4 rounded-card border border-dashed border-primary bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="redes-titulo"
          className="flex items-center gap-2 font-heading text-h3 font-semibold"
        >
          <Share2 aria-hidden="true" className="size-5 text-primary" />
          Publicar en redes
        </h2>
        <Link
          href="/admin/redes"
          className="text-meta font-semibold text-primary underline-offset-4 hover:underline"
        >
          Historial
        </Link>
      </div>
      {selector}
      {datos ? (
        <div className="grid gap-4 md:grid-cols-[minmax(0,18rem)_1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element -- imagen armada por la API */}
          <img
            src={`${buildUrl(`${path}/imagen.jpg`)}?v=${version}`}
            alt="Imagen que se va a publicar"
            className="aspect-square w-full rounded-input border border-border bg-muted object-cover"
            onError={() => setVersion((v) => v)}
          />
          <div className="flex flex-col gap-3">
            <div
              role="group"
              aria-label="Texto de la publicación"
              className="flex gap-2"
            >
              {REDES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={verTexto === r.id}
                  onClick={() => setVerTexto(r.id)}
                  className={cn(
                    "min-h-9 rounded-pill border px-3 text-meta font-semibold",
                    verTexto === r.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-primary",
                  )}
                >
                  Texto {r.nombre}
                </button>
              ))}
            </div>
            <pre className="whitespace-pre-wrap rounded-input bg-muted p-3 font-sans text-meta">
              {datos.textos[verTexto]}
            </pre>
            <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <legend className="sr-only">Dónde publicar</legend>
              {REDES.map((r) => (
                <label
                  key={r.id}
                  className={cn(
                    "flex min-h-11 items-center gap-2",
                    !datos.conectadas[r.id] && "text-muted-foreground",
                  )}
                >
                  <input
                    type="checkbox"
                    className="size-5"
                    checked={elegidas.includes(r.id)}
                    disabled={!datos.conectadas[r.id] || saving}
                    onChange={() => alternar(r.id)}
                  />
                  {r.nombre}
                  {!datos.conectadas[r.id] ? (
                    <span className="text-meta">(falta conectar)</span>
                  ) : null}
                </label>
              ))}
              <Button
                type="button"
                variant="accent"
                onClick={() => void publicar()}
                disabled={saving || elegidas.length === 0}
              >
                {saving ? "Publicando…" : "Publicar"}
              </Button>
            </fieldset>
            {!datos.conectadas.facebook && !datos.conectadas.instagram ? (
              <p className="text-meta text-muted-foreground">
                Todavía no está conectada la página de Facebook: la vista previa
                ya muestra cómo va a quedar.
              </p>
            ) : null}
            {error ? <FormMessage>{error}</FormMessage> : null}
          </div>
        </div>
      ) : error ? (
        <FormMessage>{error}</FormMessage>
      ) : (
        <p className="text-meta text-muted-foreground">Cargando…</p>
      )}
      {datos?.publicaciones.length ? (
        <ul className="flex flex-col gap-2" aria-label="Ya publicado">
          {datos.publicaciones.map((p) => (
            <EstadoPublicacion
              key={p.id}
              publicacion={p}
              onChange={(nueva) =>
                setDatos((d) =>
                  d
                    ? {
                        ...d,
                        publicaciones: d.publicaciones.map((x) =>
                          x.id === nueva.id ? nueva : x,
                        ),
                      }
                    : d,
                )
              }
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
