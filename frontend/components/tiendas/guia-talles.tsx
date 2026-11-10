"use client";

import { Ruler } from "lucide-react";
import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  cotaDe,
  type Medida,
  PrendaCotas,
  tieneFigura,
} from "@/components/tiendas/prenda-cotas";
import type { Medidas } from "@/lib/tiendas/types";
import { cn } from "@/lib/utils";

const cm = (valor: number | null) =>
  valor === null
    ? "—"
    : valor.toLocaleString("es-AR", { maximumFractionDigits: 1 });

/**
 * Guía de talles de una prenda: la figura con cada medida marcada, los cm del
 * talle que se mire y la tabla completa, para comparar con una prenda que le
 * quede bien.
 */
export function GuiaTalles({
  prenda,
  tipo,
  medidas,
  seleccionado,
}: {
  prenda: string;
  tipo: string;
  medidas: Medidas;
  seleccionado?: string;
}) {
  const inicial = () =>
    medidas.filas.some((f) => f.talle === seleccionado)
      ? (seleccionado as string)
      : medidas.filas[0]?.talle;
  const [talle, setTalle] = React.useState(inicial);
  const actual = medidas.filas.find((f) => f.talle === talle);
  const etiqueta = React.useId();
  const leyenda = medidas.columnas.map((columna, i) => ({
    numero: i + 1,
    columna,
    cota: cotaDe(columna),
    valor: cm(actual?.valores[i] ?? null),
  }));
  const conFigura = leyenda.filter((m): m is Medida & { columna: string } =>
    Boolean(m.cota),
  );
  const figura = tieneFigura(tipo) && conFigura.length > 0;

  return (
    <Dialog onOpenChange={(abierto) => abierto && setTalle(inicial())}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-1.5 self-start text-meta font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Ruler aria-hidden="true" className="size-4" />
          Guía de talles
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Guía de talles: {prenda}</DialogTitle>
          <DialogDescription>
            {medidas.aproximadas
              ? "Medidas aproximadas de la prenda, en centímetros. Pueden variar unos 2 cm."
              : "Medidas de la prenda, en centímetros."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <span id={etiqueta} className="text-meta font-semibold">
            Talle
          </span>
          <div
            role="group"
            aria-labelledby={etiqueta}
            className="flex flex-wrap gap-2"
          >
            {medidas.filas.map((f) => (
              <button
                key={f.talle}
                type="button"
                aria-pressed={f.talle === talle}
                onClick={() => setTalle(f.talle)}
                className={cn(
                  "min-h-11 min-w-11 rounded-input border px-3 text-base font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  f.talle === talle
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-primary",
                )}
              >
                {f.talle}
              </button>
            ))}
          </div>
        </div>
        <div
          className={cn(
            "flex flex-col gap-3 rounded-card bg-background p-3",
            figura && "sm:flex-row sm:items-center",
          )}
        >
          {figura ? (
            <PrendaCotas
              tipo={tipo}
              medidas={conFigura}
              className="mx-auto w-full max-w-64 shrink-0 sm:w-56"
            />
          ) : null}
          <ol
            aria-label={`Medidas del talle ${talle}`}
            className="flex flex-1 flex-col gap-2"
          >
            {leyenda.map((m) => (
              <li key={m.numero} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="flex size-5 shrink-0 items-center justify-center rounded-pill bg-primary text-[11px] font-bold text-primary-foreground"
                >
                  {m.numero}
                </span>
                <span className="flex-1 text-meta">{m.columna}</span>
                <span className="text-base font-semibold tabular-nums">
                  {m.valor === "—" ? "—" : `${m.valor} cm`}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full border-collapse text-left text-base">
            <caption className="sr-only">
              Medidas en centímetros por talle de {prenda}
            </caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-2 pr-3 text-meta font-semibold">
                  Talle
                </th>
                {medidas.columnas.map((columna) => (
                  <th
                    key={columna}
                    scope="col"
                    className="px-2 py-2 text-right text-meta font-semibold"
                  >
                    {columna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {medidas.filas.map((fila) => {
                const activo = fila.talle === talle;
                return (
                  <tr
                    key={fila.talle}
                    aria-current={activo || undefined}
                    className={cn(
                      "border-b border-border last:border-0",
                      activo && "bg-muted font-semibold",
                    )}
                  >
                    <th scope="row" className="py-2 pr-3 font-semibold">
                      {fila.talle}
                    </th>
                    {fila.valores.map((valor, i) => (
                      <td
                        key={medidas.columnas[i]}
                        className="px-2 py-2 text-right tabular-nums"
                      >
                        {cm(valor)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-meta text-muted-foreground">
          Cómo medir: apoyá sobre una mesa una prenda que le quede bien y medila
          estirada, sin tirar. El ancho de pecho va de axila a axila y el
          contorno de cintura es la vuelta completa.
        </p>
      </DialogContent>
    </Dialog>
  );
}
