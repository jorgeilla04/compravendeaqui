"use client";

import { Check, Copy, Download, ExternalLink, Share2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { api, buildUrl, errorMessage } from "@/lib/api";
import { type Red, REDES } from "@/lib/redes";
import { cn } from "@/lib/utils";

const SITIO: Record<Red, string> = {
  facebook: "https://www.facebook.com/",
  instagram: "https://www.instagram.com/",
};

interface Kit {
  textos: Record<Red, string>;
  url: string;
}

async function bajarImagen(path: string): Promise<Blob> {
  const res = await fetch(buildUrl(path), { credentials: "include" });
  if (!res.ok) throw new Error("No pudimos armar la imagen. Probá de nuevo.");
  return res.blob();
}

/**
 * Kit para redes: la imagen y el texto de un producto para que la tienda lo
 * publique en SUS redes (Facebook, Instagram, WhatsApp, TikTok…). Descargar,
 * copiar el texto o compartir directo desde el celular.
 */
export function KitRedes({
  path,
  archivo,
  selector,
}: {
  /** Ruta de la API del kit (devuelve textos; `${path}/imagen.jpg` la imagen). */
  path: string;
  /** Nombre del archivo al descargar, sin extensión. */
  archivo: string;
  selector?: React.ReactNode;
}) {
  const [kit, setKit] = React.useState<Kit | null>(null);
  const [red, setRed] = React.useState<Red>("instagram");
  const [error, setError] = React.useState<string | null>(null);
  const [copiado, setCopiado] = React.useState(false);
  const [ocupado, setOcupado] = React.useState(false);
  const [puedeCompartir, setPuedeCompartir] = React.useState(false);

  React.useEffect(() => {
    setKit(null);
    setError(null);
    api<Kit>(path)
      .then(setKit)
      .catch((err) => setError(errorMessage(err)));
  }, [path]);

  React.useEffect(() => {
    // En la compu el menú «Compartir» del sistema no ofrece Instagram ni
    // Facebook (están en el navegador), así que sólo se usa en el celular.
    const tactil = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    setPuedeCompartir(tactil && "share" in navigator);
  }, []);

  const imagen = `${path}/imagen.jpg`;
  const texto = kit?.textos[red] ?? "";

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      setError("No se pudo copiar: seleccioná el texto y copialo a mano.");
    }
  }

  async function guardarImagen() {
    const blob = await bajarImagen(imagen);
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${archivo}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  }

  /** Compu: copia el texto, baja la imagen y abre la red en otra pestaña. */
  async function publicarEn() {
    // Abrir y copiar antes de cualquier espera: el navegador sólo lo permite
    // dentro del clic.
    window.open(SITIO[red], "_blank", "noopener");
    const copia = navigator.clipboard
      ? navigator.clipboard.writeText(texto).then(
          () => true,
          () => false,
        )
      : Promise.resolve(false);
    setOcupado(true);
    setError(null);
    try {
      await guardarImagen();
      if (await copia) {
        setCopiado(true);
        window.setTimeout(() => setCopiado(false), 4000);
      } else {
        setError("La imagen se bajó, pero copiá el texto con «Copiar texto».");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setOcupado(false);
    }
  }

  async function descargar() {
    setOcupado(true);
    setError(null);
    try {
      await guardarImagen();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setOcupado(false);
    }
  }

  async function compartir() {
    setOcupado(true);
    setError(null);
    try {
      const blob = await bajarImagen(imagen);
      const file = new File([blob], `${archivo}.jpg`, { type: "image/jpeg" });
      const datos: ShareData = { files: [file], text: texto };
      // Sin soporte para archivos (algunas compus): se comparte el link.
      await navigator.share(
        navigator.canShare?.(datos) ? datos : { text: texto, url: kit?.url },
      );
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(errorMessage(err));
      }
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section
      aria-labelledby={`kit-${archivo}`}
      className="flex flex-col gap-4 rounded-card border border-border bg-card p-4"
    >
      <div className="flex flex-col gap-1">
        <h2
          id={`kit-${archivo}`}
          className="flex items-center gap-2 font-heading text-h3 font-semibold"
        >
          <Share2 aria-hidden="true" className="size-5 text-primary" />
          Kit para tus redes
        </h2>
        <p className="max-w-prose text-meta text-muted-foreground">
          Imagen y texto listos para publicar en tus redes. Desde el celular,
          «Compartir» lo abre directo en Instagram, Facebook o WhatsApp.
        </p>
      </div>
      {selector}
      {kit ? (
        <div className="grid gap-4 md:grid-cols-[minmax(0,18rem)_1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element -- imagen armada por la API */}
          <img
            src={buildUrl(imagen)}
            alt="Imagen para publicar"
            className="aspect-square w-full rounded-input border border-border bg-muted object-cover"
          />
          <div className="flex flex-col gap-3">
            <div role="group" aria-label="Texto para" className="flex gap-2">
              {REDES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={red === r.id}
                  onClick={() => setRed(r.id)}
                  className={cn(
                    "min-h-9 rounded-pill border px-3 text-meta font-semibold",
                    red === r.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-primary",
                  )}
                >
                  Texto {r.nombre}
                </button>
              ))}
            </div>
            <pre className="whitespace-pre-wrap rounded-input bg-muted p-3 font-sans text-meta">
              {texto}
            </pre>
            <div className="flex flex-wrap gap-2">
              {puedeCompartir ? (
                <Button
                  type="button"
                  variant="accent"
                  onClick={() => void compartir()}
                  disabled={ocupado}
                >
                  <Share2 aria-hidden="true" />
                  Compartir
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="accent"
                  onClick={() => void publicarEn()}
                  disabled={ocupado}
                >
                  <ExternalLink aria-hidden="true" />
                  Publicar en {REDES.find((r) => r.id === red)?.nombre}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => void descargar()}
                disabled={ocupado}
              >
                <Download aria-hidden="true" />
                Descargar imagen
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void copiar()}
              >
                {copiado ? (
                  <Check aria-hidden="true" />
                ) : (
                  <Copy aria-hidden="true" />
                )}
                {copiado ? "Copiado" : "Copiar texto"}
              </Button>
            </div>
            <p role="status" className="sr-only">
              {copiado ? "Texto copiado" : ""}
            </p>
            {!puedeCompartir ? (
              <p className="text-meta text-muted-foreground">
                «Publicar en {REDES.find((r) => r.id === red)?.nombre}» baja la
                imagen, copia el texto y abre la red: creá la publicación,
                subí la imagen y pegá el texto.
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
    </section>
  );
}
