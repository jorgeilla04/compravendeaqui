"use client";

import { Check, Minus, Plus } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { PrendaIlustracion } from "@/components/uniformes/prenda-ilustracion";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/form";
import { MAX_CANTIDAD, useCart } from "@/lib/uniformes/cart";
import { pesosLabel } from "@/lib/uniformes/cotizar";
import type { ColegioDetalle, Prenda } from "@/lib/uniformes/types";

const stepper =
  "inline-flex size-11 items-center justify-center rounded-input border border-border bg-card text-foreground transition-colors duration-200 hover:border-primary disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function PrendaCard({
  colegio,
  prenda,
}: {
  colegio: ColegioDetalle;
  prenda: Prenda;
}) {
  const { add } = useCart();
  const unico = prenda.talles.length === 1;
  const [talle, setTalle] = React.useState(unico ? prenda.talles[0] : "");
  const [cantidad, setCantidad] = React.useState(1);
  const [error, setError] = React.useState<string | null>(null);
  const [added, setAdded] = React.useState<string | null>(null);
  const id = `prenda-${prenda.slug}`;

  function handleAdd() {
    if (!talle) {
      setError("Elegí el talle.");
      return;
    }
    setError(null);
    add({
      colegio: colegio.slug,
      colegioNombre: colegio.nombre,
      color1: colegio.color1,
      color2: colegio.color2,
      prenda: prenda.slug,
      prendaNombre: prenda.nombre,
      tipo: prenda.tipo,
      talle,
      cantidad,
      precio: Number(prenda.precio),
    });
    setAdded(
      `Agregaste ${cantidad} ${prenda.nombre.toLowerCase()} talle ${talle}.`,
    );
    setCantidad(1);
  }

  return (
    <li className="flex flex-col overflow-hidden rounded-card border border-border bg-card">
      <div className="flex h-36 items-center justify-center bg-muted p-3 sm:aspect-[4/3] sm:h-auto sm:p-4">
        {prenda.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto del bucket
          <img
            src={prenda.foto_url}
            alt={`${prenda.nombre} de ${colegio.nombre}`}
            className="size-full object-contain"
          />
        ) : (
          <PrendaIlustracion
            tipo={prenda.tipo}
            color1={colegio.color1}
            color2={colegio.color2}
            className="size-full max-h-40"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id={`${id}-title`} className="font-heading text-h3 font-medium">
            {prenda.nombre}
          </h2>
          <span className="text-h3 font-semibold text-foreground">
            {pesosLabel(prenda.precio)}
          </span>
        </div>
        {unico ? (
          <p className="text-meta text-muted-foreground">Talle único</p>
        ) : (
          <SelectField
            id={`${id}-talle`}
            label="Talle"
            value={talle}
            onChange={(e) => {
              setTalle(e.target.value);
              setError(null);
            }}
            error={error}
          >
            <option value="">Elegí el talle</option>
            {prenda.talles.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </SelectField>
        )}
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
              aria-label={`Una ${prenda.nombre.toLowerCase()} menos`}
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
              aria-label={`Una ${prenda.nombre.toLowerCase()} más`}
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
            <span className="inline-flex flex-wrap items-center gap-1 font-semibold text-accent">
              <Check aria-hidden="true" className="size-4" />
              {added}{" "}
              <Link
                href="/uniformes/carrito"
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
