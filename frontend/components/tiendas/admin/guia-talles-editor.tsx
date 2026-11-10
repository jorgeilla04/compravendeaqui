"use client";

import { Plus, Trash2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import type { Medidas, ProductoAdmin } from "@/lib/tiendas/types";

const MAX_COLUMNAS = 5;
const COLUMNAS_INICIALES = ["Largo total", "Ancho de pecho (axila a axila)"];

const celda =
  "h-10 w-full min-w-16 rounded-input border border-border bg-card px-2 text-right text-base tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Fila = { talle: string; valores: string[] };

function aFilas(medidas: Medidas): Fila[] {
  return medidas.filas.map((f) => ({
    talle: f.talle,
    valores: f.valores.map((v) => (v === null ? "" : String(v))),
  }));
}

/** Filas para los talles actuales, conservando lo ya cargado de cada talle. */
function filasPara(
  talles: string[],
  columnas: number,
  previas: Fila[],
): Fila[] {
  return talles.map(
    (talle) =>
      previas.find((f) => f.talle === talle) ?? {
        talle,
        valores: Array.from({ length: columnas }, () => ""),
      },
  );
}

/**
 * Editor de la guía de talles de una prenda: columnas con nombre y los cm de
 * cada talle. Al guardar dejan de figurar como "aproximadas" en la tienda.
 */
export function GuiaTallesEditor({
  slug,
  producto,
  onSaved,
}: {
  slug: string;
  producto: ProductoAdmin;
  onSaved: (p: ProductoAdmin) => void;
}) {
  const medidas = producto.medidas ?? null;
  const [columnas, setColumnas] = React.useState<string[]>(
    medidas?.columnas ?? [],
  );
  const [filas, setFilas] = React.useState<Fila[]>(
    medidas ? aFilas(medidas) : [],
  );
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const id = `talles-${producto.slug}`;
  const path = `/admin/tiendas/${slug}/productos/${producto.slug}`;
  const hayGuia = columnas.length > 0;
  const tallesDistintos =
    hayGuia &&
    producto.opciones.join("|") !== filas.map((f) => f.talle).join("|");

  function armar() {
    setColumnas(COLUMNAS_INICIALES);
    setFilas(filasPara(producto.opciones, COLUMNAS_INICIALES.length, []));
  }

  function setValor(fila: number, columna: number, valor: string) {
    setFilas((fs) =>
      fs.map((f, i) =>
        i === fila
          ? {
              ...f,
              valores: f.valores.map((v, j) => (j === columna ? valor : v)),
            }
          : f,
      ),
    );
  }

  function agregarColumna() {
    setColumnas((cs) => [...cs, ""]);
    setFilas((fs) => fs.map((f) => ({ ...f, valores: [...f.valores, ""] })));
  }

  function quitarColumna(columna: number) {
    setColumnas((cs) => cs.filter((_, j) => j !== columna));
    setFilas((fs) =>
      fs.map((f) => ({
        ...f,
        valores: f.valores.filter((_, j) => j !== columna),
      })),
    );
  }

  async function guardar(body: { medidas: Medidas | null }) {
    setMessage(null);
    setError(null);
    setSaving(true);
    try {
      const actualizado = await api<ProductoAdmin>(path, {
        method: "PUT",
        body,
      });
      onSaved(actualizado);
      setMessage(body.medidas ? "Guardamos las medidas." : "Quitamos la guía.");
      if (!body.medidas) {
        setColumnas([]);
        setFilas([]);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function guardarMedidas() {
    if (columnas.some((c) => !c.trim())) {
      setError("Poné un nombre a cada columna (por ejemplo, Largo total).");
      return;
    }
    const numeros = filas.map((f) => ({
      talle: f.talle,
      valores: f.valores.map((v) =>
        v.trim() === "" ? null : Number(v.replace(",", ".")),
      ),
    }));
    const mala = numeros.find((f) =>
      f.valores.some(
        (v) => v !== null && (!Number.isFinite(v) || v <= 0 || v > 300),
      ),
    );
    if (mala) {
      setError(
        `Revisá las medidas del talle ${mala.talle}: van en cm, de 1 a 300.`,
      );
      return;
    }
    void guardar({
      medidas: {
        columnas: columnas.map((c) => c.trim()),
        filas: numeros,
        aproximadas: false,
      },
    });
  }

  return (
    <details className="rounded-input border border-border">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 text-meta font-semibold">
        Guía de talles (medidas en cm)
        <span className="font-normal text-muted-foreground">
          {!medidas
            ? "Sin guía"
            : medidas.aproximadas
              ? "Aproximadas: corregilas con tu ropa"
              : "Medidas propias"}
        </span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-border p-3">
        {!hayGuia ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-meta text-muted-foreground">
              Los clientes ven la tabla al elegir el talle. Medí cada prenda
              apoyada sobre una mesa.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={armar}
              disabled={producto.opciones.length === 0}
            >
              Armar guía de talles
            </Button>
            {producto.opciones.length === 0 ? (
              <p className="text-meta text-muted-foreground">
                Primero cargá los talles de la prenda.
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <div className="-mx-3 overflow-x-auto px-3">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">
                  Medidas en cm por talle de {producto.nombre}
                </caption>
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="pb-2 pr-2 align-bottom text-meta"
                    >
                      Talle
                    </th>
                    {columnas.map((columna, j) => (
                      <th
                        key={j}
                        scope="col"
                        className="px-1 pb-2 align-bottom"
                      >
                        <div className="flex items-center gap-1">
                          <input
                            aria-label={`Nombre de la columna ${j + 1}`}
                            value={columna}
                            maxLength={30}
                            onChange={(e) =>
                              setColumnas((cs) =>
                                cs.map((c, k) =>
                                  k === j ? e.target.value : c,
                                ),
                              )
                            }
                            className="h-10 w-full min-w-28 rounded-input border border-border bg-card px-2 text-meta font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                          {columnas.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => quitarColumna(j)}
                              aria-label={`Quitar la columna ${columna || j + 1}`}
                              className="flex size-10 shrink-0 items-center justify-center rounded-input text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 aria-hidden="true" className="size-4" />
                            </button>
                          ) : null}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((fila, i) => (
                    <tr key={fila.talle}>
                      <th
                        scope="row"
                        className="py-1 pr-2 text-base font-semibold"
                      >
                        {fila.talle}
                      </th>
                      {fila.valores.map((valor, j) => (
                        <td key={j} className="px-1 py-1">
                          <input
                            id={`${id}-${i}-${j}`}
                            aria-label={`${columnas[j] || "Medida"}, talle ${fila.talle}, en cm`}
                            inputMode="decimal"
                            value={valor}
                            onChange={(e) => setValor(i, j, e.target.value)}
                            className={celda}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {columnas.length < MAX_COLUMNAS ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={agregarColumna}
                >
                  <Plus aria-hidden="true" />
                  Agregar columna
                </Button>
              ) : null}
              {tallesDistintos ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setFilas((fs) =>
                      filasPara(producto.opciones, columnas.length, fs),
                    )
                  }
                >
                  Usar los talles actuales
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="primary"
                onClick={guardarMedidas}
                disabled={saving}
              >
                {saving ? "Guardando…" : "Guardar medidas"}
              </Button>
              {medidas ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void guardar({ medidas: null })}
                  disabled={saving}
                >
                  Quitar guía
                </Button>
              ) : null}
            </div>
          </>
        )}
        {message ? (
          <p className="text-meta text-success" role="status">
            {message}
          </p>
        ) : null}
        {error ? <FormMessage>{error}</FormMessage> : null}
      </div>
    </details>
  );
}
