"use client";

import { Check, Minus, Plus } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { ProductoIlustracion } from "@/components/tiendas/producto-ilustracion";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/form";
import { MAX_CANTIDAD, useCart } from "@/lib/tiendas/cart";
import { pesosLabel } from "@/lib/tiendas/cotizar";
import type { GrupoDetalle, Producto } from "@/lib/tiendas/types";

const stepper =
  "inline-flex size-11 items-center justify-center rounded-input border border-border bg-card text-foreground transition-colors duration-200 hover:border-primary disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ProductoCard({
  grupo,
  producto,
  opcionLabel,
}: {
  grupo: GrupoDetalle;
  producto: Producto;
  opcionLabel: string;
}) {
  const { add, tienda } = useCart();
  const tieneOpciones = producto.opciones.length > 0;
  const [opcion, setOpcion] = React.useState(
    producto.opciones.length === 1 ? producto.opciones[0] : "",
  );
  const [cantidad, setCantidad] = React.useState(1);
  const [error, setError] = React.useState<string | null>(null);
  const [added, setAdded] = React.useState<string | null>(null);
  const id = `producto-${producto.slug}`;
  const nombre = producto.nombre.toLowerCase();

  function handleAdd() {
    if (tieneOpciones && !opcion) {
      setError(`Elegí ${opcionLabel.toLowerCase()}.`);
      return;
    }
    setError(null);
    add({
      grupo: grupo.slug,
      grupoNombre: grupo.nombre,
      color1: grupo.color1,
      color2: grupo.color2,
      producto: producto.slug,
      productoNombre: producto.nombre,
      tipo: producto.tipo,
      fotoUrl: producto.foto_url,
      opcion: tieneOpciones ? opcion : null,
      cantidad,
      precio: Number(producto.precio),
    });
    setAdded(
      `Agregaste ${cantidad} ${nombre}${
        tieneOpciones ? ` ${opcionLabel.toLowerCase()} ${opcion}` : ""
      }.`,
    );
    setCantidad(1);
  }

  return (
    <li className="flex flex-col overflow-hidden rounded-card border border-border bg-card">
      <div className="flex h-36 items-center justify-center bg-muted p-3 sm:aspect-[4/3] sm:h-auto sm:p-4">
        {producto.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto del bucket
          <img
            src={producto.foto_url}
            alt={`${producto.nombre} de ${grupo.nombre}`}
            className="size-full object-contain"
          />
        ) : (
          <ProductoIlustracion
            tipo={producto.tipo}
            color1={grupo.color1}
            color2={grupo.color2}
            className="size-full max-h-40"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id={`${id}-title`} className="font-heading text-h3 font-medium">
            {producto.nombre}
          </h2>
          <span className="text-h3 font-semibold text-foreground">
            {pesosLabel(producto.precio)}
          </span>
        </div>
        {producto.descripcion ? (
          <p className="text-meta text-muted-foreground">
            {producto.descripcion}
          </p>
        ) : null}
        {tieneOpciones ? (
          <SelectField
            id={`${id}-opcion`}
            label={opcionLabel}
            value={opcion}
            onChange={(e) => {
              setOpcion(e.target.value);
              setError(null);
            }}
            error={error}
          >
            <option value="">Elegí {opcionLabel.toLowerCase()}</option>
            {producto.opciones.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </SelectField>
        ) : null}
        <div className="flex items-center gap-3">
          <span id={`${id}-cantidad`} className="text-meta font-semibold">
            Cantidad
          </span>
          <div
            role="group"
            aria-labelledby={`${id}-cantidad`}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              className={stepper}
              onClick={() => setCantidad((c) => Math.max(1, c - 1))}
              disabled={cantidad <= 1}
              aria-label={`Una ${nombre} menos`}
            >
              <Minus aria-hidden="true" className="size-4" />
            </button>
            <output
              aria-live="polite"
              className="min-w-8 text-center text-h3 font-semibold"
            >
              {cantidad}
            </output>
            <button
              type="button"
              className={stepper}
              onClick={() => setCantidad((c) => Math.min(MAX_CANTIDAD, c + 1))}
              disabled={cantidad >= MAX_CANTIDAD}
              aria-label={`Una ${nombre} más`}
            >
              <Plus aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
        <Button
          type="button"
          variant="primary"
          className="mt-auto w-full"
          onClick={handleAdd}
          aria-describedby={`${id}-title`}
        >
          Agregar al carrito
        </Button>
        <p aria-live="polite" className="min-h-6 text-meta">
          {added ? (
            <span className="inline-flex flex-wrap items-center gap-1 font-semibold text-success">
              <Check aria-hidden="true" className="size-4" />
              {added}{" "}
              <Link
                href={`/tiendas/${tienda}/carrito`}
                className="text-primary underline underline-offset-4"
              >
                Ver carrito
              </Link>
            </span>
          ) : null}
        </p>
      </div>
    </li>
  );
}
