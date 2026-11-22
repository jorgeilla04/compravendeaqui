"use client";

import { Check, MessageCircle } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { FormMessage, TextAreaField, TextField } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import type { Tienda } from "@/lib/tiendas/types";

/** WhatsApp a quien atiende la tienda, con el mensaje ya escrito. */
export function whatsappGrupo(tienda: Tienda, grupo: string): string {
  const label = tienda.grupo_label.toLowerCase();
  const hola = `Hola ${tienda.vendedor_nombre.split(" ")[0]}`;
  const texto = grupo.trim()
    ? `${hola}, ¿tienen ${tienda.nombre.toLowerCase()} del ${label} ${grupo.trim()}? Lo busqué en CompraVendeAquí y no lo encontré.`
    : `${hola}, ¿tienen ${tienda.nombre.toLowerCase()} de mi ${label}? No lo encontré en CompraVendeAquí.`;
  return `${tienda.whatsapp_url.split("?")[0]}?text=${encodeURIComponent(texto)}`;
}

/**
 * "¿No está tu colegio?": la consulta queda en el panel de la tienda (y le
 * llega por mail a quien atiende) o se manda directo por WhatsApp.
 */
export function ConsultaGrupo({
  tienda,
  buscado = "",
  destacado = false,
}: {
  tienda: Tienda;
  buscado?: string;
  destacado?: boolean;
}) {
  const label = tienda.grupo_label.toLowerCase();
  const [abierto, setAbierto] = React.useState(destacado);
  const [d, setD] = React.useState({
    grupo: buscado,
    nombre: "",
    telefono: "",
    mensaje: "",
  });
  const [errores, setErrores] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [listo, setListo] = React.useState(false);

  React.useEffect(() => setD((x) => ({ ...x, grupo: buscado })), [buscado]);
  React.useEffect(() => {
    if (destacado) setAbierto(true);
  }, [destacado]);

  const set =
    (k: keyof typeof d) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      setD((x) => ({ ...x, [k]: e.target.value }));
      setErrores((x) => ({ ...x, [k]: "" }));
    };

  async function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const faltan: Record<string, string> = {};
    if (d.grupo.trim().length < 2)
      faltan.grupo = `Escribí el nombre del ${label}.`;
    if (d.nombre.trim().length < 2) faltan.nombre = "Poné tu nombre.";
    if (d.telefono.replace(/\D/g, "").length < 8)
      faltan.telefono = "Poné un teléfono con código de área.";
    setErrores(faltan);
    if (Object.keys(faltan).length) {
      document.getElementById(`consulta-${Object.keys(faltan)[0]}`)?.focus();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api(`/tiendas/${tienda.slug}/consultas`, {
        method: "POST",
        body: {
          grupo: d.grupo.trim(),
          nombre: d.nombre.trim(),
          telefono: d.telefono.trim(),
          mensaje: d.mensaje.trim() || null,
        },
      });
      setListo(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      id="no-esta"
      aria-labelledby="no-esta-titulo"
      className="flex scroll-mt-36 flex-col gap-3 rounded-card border border-border bg-card p-4 sm:p-5"
    >
      <h2 id="no-esta-titulo" className="font-heading text-h2 font-semibold">
        ¿No está tu {label}?
      </h2>
      <p className="text-muted-foreground">
        Seguimos sumando {label}s. Preguntanos por el tuyo y te avisamos si lo
        tenemos o cuándo lo cargamos.
      </p>
      {listo ? (
        <p
          role="status"
          className="flex items-center gap-2 font-semibold text-success"
        >
          <Check aria-hidden="true" className="size-5" />
          Recibimos tu consulta. Te escribimos por WhatsApp a la brevedad.
        </p>
      ) : abierto ? (
        <form onSubmit={enviar} noValidate className="flex flex-col gap-3">
          <TextField
            id="consulta-grupo"
            label={`Nombre del ${label}`}
            value={d.grupo}
            onChange={set("grupo")}
            error={errores.grupo}
            maxLength={160}
            disabled={saving}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              id="consulta-nombre"
              label="Tu nombre"
              autoComplete="name"
              value={d.nombre}
              onChange={set("nombre")}
              error={errores.nombre}
              disabled={saving}
            />
            <TextField
              id="consulta-telefono"
              label="Teléfono (WhatsApp)"
              type="tel"
              autoComplete="tel"
              value={d.telefono}
              onChange={set("telefono")}
              error={errores.telefono}
              disabled={saving}
            />
          </div>
          <TextAreaField
            id="consulta-mensaje"
            label="Qué necesitás"
            hint="Prendas y talles, por ejemplo: chomba talle 10 y jogging talle 12."
            rows={2}
            maxLength={1000}
            value={d.mensaje}
            onChange={set("mensaje")}
            optional
            disabled={saving}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Enviando…" : "Enviar consulta"}
            </Button>
            <Button asChild variant="whatsapp">
              <a
                href={whatsappGrupo(tienda, d.grupo)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle aria-hidden="true" />
                Preguntar por WhatsApp
              </a>
            </Button>
          </div>
          {error ? <FormMessage>{error}</FormMessage> : null}
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="primary"
            onClick={() => setAbierto(true)}
          >
            Consultar por mi {label}
          </Button>
          <Button asChild variant="whatsapp">
            <a
              href={whatsappGrupo(tienda, "")}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle aria-hidden="true" />
              Preguntar por WhatsApp
            </a>
          </Button>
        </div>
      )}
    </section>
  );
}
