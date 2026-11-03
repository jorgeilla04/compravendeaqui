"use client";

import { ChevronLeft, ChevronRight, ImageOff, ZoomIn } from "lucide-react";
import Image from "next/image";
import * as React from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { ListingImage } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Galería del aviso: foto principal, miniaturas y zoom a pantalla completa. */
export function Gallery({
  images,
  title,
}: {
  images: ListingImage[];
  title: string;
}) {
  const [index, setIndex] = React.useState(0);
  const [zoom, setZoom] = React.useState(false);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-card bg-muted text-muted-foreground">
        <ImageOff aria-hidden="true" className="size-10" />
        <span className="text-meta">Este aviso no tiene fotos</span>
      </div>
    );
  }

  const current = images[index] ?? images[0];
  const go = (delta: number) =>
    setIndex((i) => (i + delta + images.length) % images.length);
  const label = (i: number) => `Foto ${i + 1} de ${images.length}: ${title}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-card bg-muted">
        <button
          type="button"
          onClick={() => setZoom(true)}
          className="group absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          aria-label={`Ampliar ${label(index).toLowerCase()}`}
        >
          <Image
            src={current.url}
            alt={label(index)}
            fill
            priority={index === 0}
            sizes="(min-width: 1024px) 60vw, 100vw"
            className="object-contain"
          />
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-pill bg-black/60 px-3 py-1 text-meta font-semibold text-white">
            <ZoomIn aria-hidden="true" className="size-4" />
            {index + 1}/{images.length}
          </span>
        </button>
        {images.length > 1 ? (
          <>
            <NavButton side="left" onClick={() => go(-1)} />
            <NavButton side="right" onClick={() => go(1)} />
          </>
        ) : null}
      </div>

      {images.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Miniaturas">
          {images.map((image, i) => (
            <li key={image.id} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Ver foto ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  "relative block size-16 overflow-hidden rounded-input border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  i === index
                    ? "border-primary"
                    : "border-transparent opacity-80 hover:opacity-100",
                )}
              >
                <Image
                  src={image.thumb_url ?? image.url}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent
          className="max-w-5xl bg-black p-2 sm:p-4"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">{label(index)}</DialogTitle>
          <div className="relative h-[80dvh] w-full">
            <Image
              src={current.url}
              alt={label(index)}
              fill
              sizes="100vw"
              className="object-contain"
            />
            {images.length > 1 ? (
              <>
                <NavButton side="left" onClick={() => go(-1)} />
                <NavButton side="right" onClick={() => go(1)} />
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NavButton({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Foto anterior" : "Foto siguiente"}
      className={cn(
        "absolute top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-pill bg-black/60 text-white hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
        side === "left" ? "left-2" : "right-2",
      )}
    >
      <Icon aria-hidden="true" className="size-6" />
    </button>
  );
}
