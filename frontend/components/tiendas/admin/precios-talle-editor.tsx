"use client";

import { Plus, Trash2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import { pesosLabel } from "@/lib/tiendas/cotizar";
import type { ProductoAdmin, Tramo } from "@/lib/tiendas/types";
import { cn } from "@/lib/utils";

const campo =
  "h-11 w-full rounded-input border border-border bg-card px-3 text-base tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

type Fila = {
  talles: string[];
  precio: string;
  costo: string;
  consultar: boolean;
};

const aTexto = (v: string | null | undefined) =>
  v == null ? "" : String(Number(v));
const aNumero = (v: string) => Number(v.replace(/\./g, "").replace(",", "."));

/** "Ganás $X (Y%)": margen sobre el precio de venta, solo de referencia. */
export function margen(precio: string, costo: string): string | null {
  const p = aNumero(precio);
  const c = aNumero(costo);
  if (!precio.trim() || !costo.trim() || !(p > 0) || !(c >= 0)) return null;
  const ganancia = p - c;
  return `${ganancia < 0 ? "Perdés" : "Ganás"} ${pesosLabel(Math.abs(ganancia))} (${Math.round((ganancia / p) * 100)}%)`;
}

/**
 * Precios distintos por grupos de talles (ej.: 4 a 16, S a XL, XXL a 5XL a
 * consultar) y costos de referencia. La tienda publica el más económico y el
 * precio cambia al elegir el talle; los costos solo se ven acá.
 */
export function PreciosTalleEditor({
  slug,
  producto,
  onSaved,
}: {
  slug: string;
  producto: ProductoAdmin;
  onSaved: (p: ProductoAdmin) => void;
}) {
  const [filas, setFilas] = React.useState<Fila[]>(
    (producto.tramos ?? []).map((t) => ({
      talles: t.talles,
      precio: aTexto(t.precio),
      costo: aTexto(t.costo),
      consultar: t.precio === null,
    })),
  );
  const [costoBase, setCostoBase] = React.useState(aTexto(producto.costo));
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const id = `tramos-${producto.slug}`;
  const usados = new Set(filas.flatMap((f) => f.talles));
  const libres = producto.opciones.filter((o) => !usados.has(o));
  const base = String(Number(producto.precio_base));

  const cambiar = (i: number, cambio: Partial<Fila>) =>
    setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, ...cambio } : f)));

  function alternar(i: number, talle: string) {
    const fila = filas[i];
    cambiar(i, {
      talles: fila.talles.includes(talle)
        ? fila.talles.filter((t) => t !== talle)
        : producto.opciones.filter(
            (o) => o === talle || fila.talles.includes(o),
          ),
    });
  }

  async function guardar() {
    setMessage(null);
    setError(null);
    const tramos: Tramo[] = [];
    for (const [i, f] of filas.entries()) {
      if (f.talles.length === 0) {
        setError(`Elegí al menos un talle en el precio ${i + 1}, o quitalo.`);
        return;
      }
      const precio = aNumero(f.precio);
      if (!f.consultar && !(precio >= 0 && f.precio.trim())) {
        setError(
          `Poné el precio de los talles ${f.talles.join(", ")} o marcá "Consultar".`,
        );
        return;
      }
      const costo = f.costo.trim() ? aNumero(f.costo) : null;
      if (costo !== null && !(costo >= 0)) {
        setError(`Revisá el costo de los talles ${f.talles.join(", ")}.`);
        return;
      }
      tramos.push({
        talles: f.talles,
        precio: f.consultar ? null : String(precio),
        costo: costo === null ? null : String(costo),
      });
    }
    const costo = costoBase.trim() ? aNumero(costoBase) : null;
    if (costo !== null && !(costo >= 0)) {
      setError("Revisá el costo del precio base.");
      return;
    }
    setSaving(true);
    try {
      onSaved(
        await api<ProductoAdmin>(
          `/admin/tiendas/${slug}/productos/${producto.slug}`,
          {
            method: "PUT",
            body: { tramos, costo: costo === null ? null : String(costo) },
          },
        ),
      );
      setMessage("Guardamos los precios por talle.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <details
      className="rounded-input border border-border"
      open={filas.length > 0 || undefined}
    >
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 text-meta font-semibold">
        Precios por talle y costos
        <span className="font-normal text-muted-foreground">
          {filas.length === 0
            ? "Mismo precio para todos"
            : `${filas.length + (libres.length ? 1 : 0)} precios`}
        </span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-border p-3">
        <p className="text-meta text-muted-foreground">
          La tienda muestra el precio más económico y lo cambia al elegir el
          talle. Los talles a consultar muestran un botón de WhatsApp en lugar
          del carrito. Valen para todos los colegios. Los costos solo los ves vos.
        </p>
        {producto.opciones.length === 0 ? (
          <p className="text-meta text-muted-foreground">
            Primero cargá y guardá los talles de la prenda.
          </p>
        ) : null}
        <ol className="flex flex-col gap-3">
          {filas.map((f, i) => {
            const m = f.consultar ? null : margen(f.precio, f.costo);
            return (
              <li
                key={i}
                className="flex flex-col gap-3 rounded-input bg-muted p-3"
              >
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-meta font-semibold">
                    Talles con este precio
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {producto.opciones.map((t) => {
                      const elegido = f.talles.includes(t);
                      const enOtro = !elegido && usados.has(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          aria-pressed={elegido}
                          disabled={enOtro || saving}
                          onClick={() => alternar(i, t)}
                          className={cn(
                            "min-h-11 min-w-11 rounded-input border px-3 font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
                            elegido
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card hover:border-primary",
                          )}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <label
                    htmlFor={`${id}-${i}-precio`}
                    className="flex flex-col gap-1 text-meta font-semibold"
                  >
                    Precio de venta ($)
                    <input
                      id={`${id}-${i}-precio`}
                      inputMode="decimal"
                      value={f.consultar ? "" : f.precio}
                      placeholder={f.consultar ? "Consultar" : undefined}
                      disabled={f.consultar || saving}
                      onChange={(e) => cambiar(i, { precio: e.target.value })}
                      className={campo}
                    />
                  </label>
                  <label
                    htmlFor={`${id}-${i}-costo`}
                    className="flex flex-col gap-1 text-meta font-semibold"
                  >
                    Costo ($, solo para vos)
                    <input
                      id={`${id}-${i}-costo`}
                      inputMode="decimal"
                      value={f.costo}
                      disabled={saving}
                      onChange={(e) => cambiar(i, { costo: e.target.value })}
                      className={campo}
                    />
                  </label>
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 text-base">
                    <input
                      type="checkbox"
                      className="size-5"
                      checked={f.consultar}
                      disabled={saving}
                      onChange={(e) =>
                        cambiar(i, { consultar: e.target.checked })
                      }
                    />
                    Consultar
                  </label>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-meta text-muted-foreground">
                    {m ?? (f.consultar ? "Se consulta por WhatsApp" : "")}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setFilas((fs) => fs.filter((_, j) => j !== i))
                    }
                    disabled={saving}
                  >
                    <Trash2 aria-hidden="true" />
                    Quitar este precio
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
        {libres.length ? (
          <div className="flex flex-col gap-2 rounded-input border border-dashed border-border p-3">
            <p className="text-meta">
              <strong>Talles {libres.join(", ")}</strong>: precio base{" "}
              {pesosLabel(base)}
              {producto.tramos?.length || filas.length
                ? ""
                : " (todos los talles)"}
            </p>
            <label
              htmlFor={`${id}-costo-base`}
              className="flex max-w-xs flex-col gap-1 text-meta font-semibold"
            >
              Costo del precio base ($, solo para vos)
              <input
                id={`${id}-costo-base`}
                inputMode="decimal"
                value={costoBase}
                disabled={saving}
                onChange={(e) => setCostoBase(e.target.value)}
                className={campo}
              />
            </label>
            {margen(base, costoBase) ? (
              <span className="text-meta text-muted-foreground">
                {margen(base, costoBase)}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={saving || libres.length === 0}
            onClick={() =>
              setFilas((fs) => [
                ...fs,
                { talles: [], precio: "", costo: "", consultar: false },
              ])
            }
          >
            <Plus aria-hidden="true" />
            Agregar precio por talle
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => void guardar()}
            disabled={saving}
          >
            {saving ? "Guardando…" : "Guardar precios"}
          </Button>
        </div>
        {message ? (
          <p role="status" className="text-meta text-success">
            {message}
          </p>
        ) : null}
        {error ? <FormMessage>{error}</FormMessage> : null}
      </div>
    </details>
  );
}
