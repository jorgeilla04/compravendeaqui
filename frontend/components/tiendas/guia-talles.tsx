"use client";

import { Ruler } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Medidas } from "@/lib/tiendas/types";
import { cn } from "@/lib/utils";

const cm = (valor: number | null) =>
  valor === null
    ? "—"
    : valor.toLocaleString("es-AR", { maximumFractionDigits: 1 });

/**
 * Tabla de medidas de una prenda en centímetros. Resalta el talle elegido
 * para que se compare directo con una prenda que le quede bien.
 */
export function GuiaTalles({
  prenda,
  medidas,
  seleccionado,
}: {
  prenda: string;
  medidas: Medidas;
  seleccionado?: string;
}) {
  return (
    <Dialog>
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
                const activo = fila.talle === seleccionado;
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
