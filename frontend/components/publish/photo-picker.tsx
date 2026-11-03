"use client";

import { ImagePlus, Star, Trash2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ACCEPT_ATTR, MAX_PHOTOS, MAX_PHOTO_MB } from "./photo-files";

/**
 * Botón para elegir fotos (galería o cámara: no forzamos `capture`).
 * El input nativo queda dentro del label para conservar foco y teclado.
 */
export function PhotoPicker({
  id,
  count,
  disabled,
  label = "Subí fotos",
  onFiles,
}: {
  id: string;
  count: number;
  disabled?: boolean;
  label?: string;
  onFiles: (files: File[]) => void;
}) {
  const full = count >= MAX_PHOTOS;
  const hintId = `${id}-hint`;
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className={cn(
          "inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-input border border-dashed border-primary bg-card px-5 text-base font-semibold text-foreground transition-colors duration-200 hover:bg-muted sm:w-auto sm:self-start",
          "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background",
          (disabled || full) && "pointer-events-none opacity-50",
        )}
      >
        <ImagePlus aria-hidden="true" className="size-5" />
        {full ? "Llegaste al máximo de fotos" : label}
        <input
          id={id}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          disabled={disabled || full}
          aria-describedby={hintId}
          className="sr-only"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            // Permite volver a elegir el mismo archivo.
            e.target.value = "";
            if (files.length > 0) onFiles(files);
          }}
        />
      </label>
      <p id={hintId} className="text-meta text-muted-foreground">
        {count} de {MAX_PHOTOS} fotos. JPG, PNG o WEBP de hasta {MAX_PHOTO_MB}{" "}
        MB cada una. La primera es la portada.
      </p>
    </div>
  );
}

/** Miniatura con acciones "Usar como portada" y "Quitar". */
export function PhotoTile({
  index,
  isCover,
  disabled,
  onMakeCover,
  onRemove,
  removeLabel = "Quitar",
  children,
}: {
  index: number;
  isCover: boolean;
  disabled?: boolean;
  onMakeCover: () => void;
  onRemove: () => void;
  removeLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-col overflow-hidden rounded-card border border-border bg-card">
      <div className="relative aspect-square w-full bg-muted">
        {children}
        {isCover ? (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-pill bg-primary px-2.5 py-0.5 text-meta font-semibold text-primary-foreground">
            <Star aria-hidden="true" className="size-3.5" />
            Portada
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-1 p-2">
        {isCover ? null : (
          <Button
            type="button"
            variant="ghost"
            className="w-full px-2 text-meta"
            disabled={disabled}
            onClick={onMakeCover}
            aria-label={`Usar como portada (foto ${index + 1})`}
          >
            Usar como portada
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          className="w-full px-2 text-meta text-destructive hover:text-destructive"
          disabled={disabled}
          onClick={onRemove}
          aria-label={`${removeLabel} (foto ${index + 1})`}
        >
          <Trash2 aria-hidden="true" />
          {removeLabel}
        </Button>
      </div>
    </li>
  );
}
