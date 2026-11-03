"use client";

import { Pencil } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { conditionLabel, formatPrice } from "@/lib/format";
import type { CategoryNode } from "@/lib/types";

import { categoryPath, parsePrice, type ListingDraft } from "./listing-draft";
import type { LocalPhoto } from "./photos-step";

function Section({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 border-b border-border py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading text-h3 font-medium text-foreground">
          {title}
        </h3>
        <Button
          type="button"
          variant="ghost"
          onClick={onEdit}
          aria-label={`Editar ${title.toLowerCase()}`}
        >
          <Pencil aria-hidden="true" />
          Editar
        </Button>
      </div>
      <dl className="grid gap-x-4 gap-y-1 text-base sm:grid-cols-[10rem_1fr]">
        {children}
      </dl>
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-meta font-semibold text-muted-foreground sm:text-base sm:font-normal">
        {label}
      </dt>
      <dd className="mb-2 break-words text-foreground sm:mb-0">{children}</dd>
    </>
  );
}

/** Paso 5: resumen con atajos "Editar" a cada paso. */
export function ReviewStep({
  draft,
  tree,
  photos,
  onEditStep,
}: {
  draft: ListingDraft;
  tree: CategoryNode[];
  photos: LocalPhoto[];
  onEditStep: (step: number) => void;
}) {
  const path = categoryPath(tree, draft.categoryId);
  const price = parsePrice(draft.price);
  const condition =
    draft.condition && draft.condition !== "na"
      ? conditionLabel(draft.condition)
      : "No aplica";

  return (
    <div className="flex flex-col">
      <Section title="Categoría" onEdit={() => onEditStep(0)}>
        <Row label="Categoría">{path.map((c) => c.name).join(" › ")}</Row>
      </Section>
      <Section title="Detalles" onEdit={() => onEditStep(1)}>
        <Row label="Título">{draft.title.trim()}</Row>
        <Row label="Descripción">
          <span className="whitespace-pre-line">
            {draft.description.trim()}
          </span>
        </Row>
        <Row label="Condición">{condition}</Row>
      </Section>
      <Section title="Precio y ubicación" onEdit={() => onEditStep(2)}>
        <Row label="Precio">
          <span className="font-heading font-semibold">
            {formatPrice(price.ok ? price.value : null, draft.currency)}
          </span>
        </Row>
        <Row label="Ubicación">
          {[draft.location.trim(), draft.department].filter(Boolean).join(", ")}
        </Row>
      </Section>
      <Section title="Fotos" onEdit={() => onEditStep(3)}>
        <Row label="Fotos">
          {photos.length === 0 ? (
            "Sin fotos"
          ) : (
            <span className="flex flex-col gap-2">
              <span>
                {photos.length === 1 ? "1 foto" : `${photos.length} fotos`}
              </span>
              <span className="flex gap-2 overflow-x-auto pb-1">
                {photos.map((photo, index) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={photo.id}
                    src={photo.url}
                    alt={index === 0 ? "Portada" : `Foto ${index + 1}`}
                    className="size-16 shrink-0 rounded-input object-cover"
                  />
                ))}
              </span>
            </span>
          )}
        </Row>
      </Section>
    </div>
  );
}
