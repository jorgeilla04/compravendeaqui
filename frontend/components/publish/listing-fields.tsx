"use client";

import * as React from "react";

import { SelectField, TextAreaField, TextField } from "@/components/ui/form";
import { CONDITIONS, DEPARTMENTS } from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CategoryNode, Condition, Currency } from "@/lib/types";

import {
  DESCRIPTION_MAX,
  LOCATION_MAX,
  TITLE_MAX,
  parsePrice,
  type DraftErrors,
  type ListingDraft,
} from "./listing-draft";

type Patch = (patch: Partial<ListingDraft>) => void;

interface FieldsProps {
  draft: ListingDraft;
  errors: DraftErrors;
  onChange: Patch;
  disabled?: boolean;
}

// --- Grupo de radios en "tiles" --------------------------------------------------

interface RadioOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

/** fieldset + legend; el radio nativo queda visible (estado no solo por color). */
export function RadioTiles<T extends string>({
  name,
  legend,
  optional,
  options,
  value,
  onChange,
  disabled,
  columns = 3,
}: {
  name: string;
  legend: string;
  optional?: boolean;
  options: readonly RadioOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
  columns?: 2 | 3 | 4;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5" disabled={disabled}>
      <legend className="mb-1.5 text-meta font-semibold text-foreground">
        {legend}
        {optional ? (
          <span className="font-normal text-muted-foreground"> (opcional)</span>
        ) : null}
      </legend>
      <div
        className={cn(
          "grid gap-2",
          columns === 2 && "grid-cols-2",
          columns === 3 && "grid-cols-1 sm:grid-cols-3",
          columns === 4 && "grid-cols-2 sm:grid-cols-4",
        )}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-3 rounded-input border border-border bg-card px-3 py-2 text-base text-foreground transition-colors duration-200",
              "has-[:checked]:bg-primary/10 hover:bg-muted has-[:checked]:border-primary has-[:checked]:font-semibold",
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background",
              "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="size-5 shrink-0 accent-primary focus-visible:outline-none"
            />
            <span className="flex flex-col">
              <span>{option.label}</span>
              {option.hint ? (
                <span className="text-meta font-normal text-muted-foreground">
                  {option.hint}
                </span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// --- Detalles -------------------------------------------------------------------

const CONDITION_OPTIONS: readonly RadioOption<Condition | "na">[] = [
  ...CONDITIONS,
  { value: "na", label: "No aplica" },
];

export function DetailsFields({
  draft,
  errors,
  onChange,
  disabled,
}: FieldsProps) {
  return (
    <div className="flex flex-col gap-5">
      <TextField
        id="listing-title"
        label="Título"
        value={draft.title}
        onChange={(e) => onChange({ title: e.target.value })}
        maxLength={TITLE_MAX}
        autoComplete="off"
        enterKeyHint="next"
        placeholder="Ej: Heladera Gafa 350 litros no frost"
        hint={`${draft.title.length} de ${TITLE_MAX} caracteres. Poné qué es, marca y modelo.`}
        error={errors.title}
        disabled={disabled}
      />
      <TextAreaField
        id="listing-description"
        label="Descripción"
        value={draft.description}
        onChange={(e) => onChange({ description: e.target.value })}
        maxLength={DESCRIPTION_MAX}
        rows={6}
        placeholder="Estado, medidas, qué incluye, si hacés envíos o cómo se retira."
        hint="Contá lo que te preguntaría alguien antes de escribirte."
        error={errors.description}
        disabled={disabled}
      />
      <RadioTiles<Condition | "na">
        name="listing-condition"
        legend="Condición"
        optional
        columns={4}
        options={CONDITION_OPTIONS}
        value={draft.condition}
        onChange={(condition) => onChange({ condition })}
        disabled={disabled}
      />
    </div>
  );
}

// --- Precio y ubicación ------------------------------------------------------------

const CURRENCY_OPTIONS: readonly RadioOption<Currency>[] = [
  { value: "ARS", label: "Pesos", hint: "Se muestra con $" },
  { value: "USD", label: "Dólares", hint: "Se muestra con US$" },
];

export function PriceLocationFields({
  draft,
  errors,
  onChange,
  disabled,
}: FieldsProps) {
  const parsed = parsePrice(draft.price);
  const symbol = draft.currency === "USD" ? "US$" : "$";
  const preview = parsed.ok ? formatPrice(parsed.value, draft.currency) : null;

  return (
    <div className="flex flex-col gap-5">
      <RadioTiles<Currency>
        name="listing-currency"
        legend="Moneda"
        columns={2}
        options={CURRENCY_OPTIONS}
        value={draft.currency}
        onChange={(currency) => onChange({ currency })}
        disabled={disabled}
      />
      <div className="flex flex-col gap-1.5">
        <TextField
          id="listing-price"
          label={`Precio en ${draft.currency === "USD" ? "dólares" : "pesos"} (${symbol})`}
          optional
          value={draft.price}
          onChange={(e) => onChange({ price: e.target.value })}
          inputMode="decimal"
          autoComplete="off"
          placeholder={draft.currency === "USD" ? "15.900" : "480.000"}
          hint="Si lo dejás vacío, el aviso dice «Precio a consultar»."
          error={errors.price}
          disabled={disabled}
        />
        {preview ? (
          <p className="text-meta text-foreground">
            Se va a ver así:{" "}
            <span className="font-heading font-semibold">{preview}</span>
          </p>
        ) : null}
      </div>
      <SelectField
        id="listing-department"
        label="Departamento"
        value={draft.department}
        onChange={(e) => onChange({ department: e.target.value })}
        error={errors.department}
        disabled={disabled}
      >
        <option value="" disabled>
          Elegí un departamento
        </option>
        {DEPARTMENTS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </SelectField>
      <TextField
        id="listing-location"
        label="Localidad o barrio"
        optional
        value={draft.location}
        onChange={(e) => onChange({ location: e.target.value })}
        maxLength={LOCATION_MAX}
        autoComplete="address-level3"
        placeholder="Ej: Barrio Aramburu"
        error={errors.location}
        disabled={disabled}
      />
    </div>
  );
}

// --- Categoría como select (edición) ---------------------------------------------------

export function CategorySelect({
  tree,
  value,
  fallback,
  error,
  onChange,
  disabled,
}: {
  tree: CategoryNode[];
  value: string | null;
  /** Categoría actual si no figura en el árbol (p. ej. una categoría padre). */
  fallback?: { id: string; name: string };
  error?: string;
  onChange: (categoryId: string, parentId: string | null) => void;
  disabled?: boolean;
}) {
  const known = React.useMemo(() => {
    const ids = new Set<string>();
    for (const parent of tree) {
      if (parent.children.length === 0) ids.add(parent.id);
      for (const child of parent.children) ids.add(child.id);
    }
    return ids;
  }, [tree]);

  const leaves = tree.filter((c) => c.children.length === 0);
  const groups = tree.filter((c) => c.children.length > 0);

  return (
    <SelectField
      id="listing-category"
      label="Categoría"
      value={value ?? ""}
      onChange={(e) => {
        const id = e.target.value;
        const parent = tree.find((p) => p.children.some((c) => c.id === id));
        onChange(id, parent?.id ?? null);
      }}
      error={error}
      disabled={disabled}
    >
      <option value="" disabled>
        Elegí una categoría
      </option>
      {fallback && !known.has(fallback.id) ? (
        <option value={fallback.id}>{fallback.name}</option>
      ) : null}
      {groups.map((parent) => (
        <optgroup key={parent.id} label={parent.name}>
          {parent.children.map((child) => (
            <option key={child.id} value={child.id}>
              {child.name}
            </option>
          ))}
        </optgroup>
      ))}
      {leaves.length > 0 ? (
        <optgroup label="Otras categorías">
          {leaves.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </optgroup>
      ) : null}
    </SelectField>
  );
}
