"use client";

import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/form";
import { CONDITIONS, DEPARTMENTS } from "@/lib/constants";
import type { CategoryNode } from "@/lib/types";

import type { SearchFilters } from "./params";

interface Props {
  idPrefix: string;
  filters: SearchFilters;
  categories: CategoryNode[];
  /** En páginas de categoría el rubro es fijo y no se muestra. */
  lockCategory?: boolean;
  onApply: (filters: SearchFilters) => void;
}

/** Formulario de filtros (sidebar en desktop, drawer en mobile). */
export function FiltersForm({
  idPrefix,
  filters,
  categories,
  lockCategory,
  onApply,
}: Props) {
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const read = (key: string) =>
      String(data.get(key) ?? "").trim() || undefined;
    onApply({
      ...filters,
      category: lockCategory ? filters.category : read("category"),
      department: read("department"),
      condition: read("condition"),
      currency: read("currency"),
      price_min: read("price_min")?.replace(/\D/g, "") || undefined,
      price_max: read("price_max")?.replace(/\D/g, "") || undefined,
    });
  }

  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4"
      aria-label="Filtros"
    >
      {!lockCategory ? (
        <SelectField
          id={id("category")}
          name="category"
          label="Categoría"
          defaultValue={filters.category ?? ""}
        >
          <option value="">Todas</option>
          {categories.map((parent) => (
            <optgroup key={parent.id} label={parent.name}>
              <option value={parent.slug}>Todo {parent.name}</option>
              {parent.children.map((child) => (
                <option key={child.id} value={child.slug}>
                  {child.name}
                </option>
              ))}
            </optgroup>
          ))}
        </SelectField>
      ) : null}
      <SelectField
        id={id("department")}
        name="department"
        label="Departamento"
        defaultValue={filters.department ?? ""}
      >
        <option value="">Toda la provincia</option>
        {DEPARTMENTS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </SelectField>
      <SelectField
        id={id("condition")}
        name="condition"
        label="Condición"
        defaultValue={filters.condition ?? ""}
      >
        <option value="">Cualquiera</option>
        {CONDITIONS.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </SelectField>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1.5 text-meta font-semibold text-foreground">
          Precio
        </legend>
        <SelectField
          id={id("currency")}
          name="currency"
          label="Moneda"
          hint="Sin moneda, el rango se toma en pesos y también incluye avisos en dólares."
          defaultValue={filters.currency ?? ""}
        >
          <option value="">Pesos y dólares</option>
          <option value="ARS">Solo en pesos ($)</option>
          <option value="USD">Solo en dólares (US$)</option>
        </SelectField>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            id={id("price_min")}
            name="price_min"
            label="Desde"
            inputMode="numeric"
            defaultValue={filters.price_min ?? ""}
          />
          <TextField
            id={id("price_max")}
            name="price_max"
            label="Hasta"
            inputMode="numeric"
            defaultValue={filters.price_max ?? ""}
          />
        </div>
      </fieldset>
      <Button type="submit">Ver resultados</Button>
    </form>
  );
}
