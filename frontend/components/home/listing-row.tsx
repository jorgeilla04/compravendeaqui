"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { ListingCard } from "@/components/listings/listing-card";
import type { ListingCard as ListingCardData } from "@/lib/types";

/**
 * Fila de avisos de un rubro: se desliza con el dedo en el celular y con
 * flechas en desktop. Las flechas desaparecen al llegar a cada punta.
 */
export function ListingRow({
  id,
  titulo,
  href,
  items,
}: {
  id: string;
  titulo: string;
  href: string;
  items: ListingCardData[];
}) {
  const lista = React.useRef<HTMLUListElement>(null);
  const [puntas, setPuntas] = React.useState({ inicio: true, fin: false });

  const medir = React.useCallback(() => {
    const el = lista.current;
    if (!el) return;
    setPuntas({
      inicio: el.scrollLeft <= 4,
      fin: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
  }, []);

  React.useEffect(() => {
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [medir]);

  const mover = (sentido: 1 | -1) =>
    lista.current?.scrollBy({
      left: sentido * lista.current.clientWidth * 0.9,
      behavior: "smooth",
    });

  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={id} className="font-heading text-h2 font-semibold">
          {titulo}
        </h2>
        <Link
          href={href}
          className="shrink-0 text-meta font-semibold text-primary underline-offset-4 hover:underline"
        >
          Ver todos
        </Link>
      </div>
      <div className="relative">
        <ul
          ref={lista}
          onScroll={medir}
          className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-2 [scrollbar-width:none] sm:gap-4 lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item) => (
            <li
              key={item.id}
              className="flex w-[44%] shrink-0 snap-start min-[480px]:w-[31%] md:w-[23%] lg:w-[calc((100%-4rem)/5)]"
            >
              <div className="flex-1">
                <ListingCard listing={item} />
              </div>
            </li>
          ))}
        </ul>
        {!puntas.inicio ? (
          <button
            type="button"
            onClick={() => mover(-1)}
            aria-label={`Ver avisos anteriores de ${titulo}`}
            className="absolute -left-5 top-[30%] hidden size-11 items-center justify-center rounded-pill border border-border bg-card text-foreground shadow-md transition-colors hover:text-primary lg:flex"
          >
            <ChevronLeft aria-hidden="true" className="size-6" />
          </button>
        ) : null}
        {!puntas.fin ? (
          <button
            type="button"
            onClick={() => mover(1)}
            aria-label={`Ver más avisos de ${titulo}`}
            className="absolute -right-5 top-[30%] hidden size-11 items-center justify-center rounded-pill border border-border bg-card text-foreground shadow-md transition-colors hover:text-primary lg:flex"
          >
            <ChevronRight aria-hidden="true" className="size-6" />
          </button>
        ) : null}
      </div>
    </section>
  );
}
