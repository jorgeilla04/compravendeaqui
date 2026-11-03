/**
 * Estado del formulario de aviso y validaciones puras (sin React), compartidas
 * por el wizard de /publicar y la edición. Espejo de backend/app/schemas/listing.py.
 */

import { DEPARTMENTS } from "@/lib/constants";
import type {
  CategoryNode,
  Condition,
  Currency,
  ListingInput,
  OwnerListing,
} from "@/lib/types";

export const TITLE_MIN = 5;
export const TITLE_MAX = 120;
export const DESCRIPTION_MIN = 10;
export const DESCRIPTION_MAX = 5000;
export const LOCATION_MAX = 255;

export interface ListingDraft {
  /** Categoría padre elegida en el wizard (para mostrar sus hijas). */
  parentId: string | null;
  /** Categoría final del aviso. */
  categoryId: string | null;
  title: string;
  description: string;
  /** null = sin responder; "na" = no aplica (se envía null). */
  condition: Condition | "na" | null;
  currency: Currency;
  /** Tal como lo escribe la persona ("480.000", "15900,50"). */
  price: string;
  department: string;
  location: string;
}

export type DraftField =
  | "category"
  | "title"
  | "description"
  | "price"
  | "department"
  | "location";

export type DraftErrors = Partial<Record<DraftField, string>>;

export const emptyDraft: ListingDraft = {
  parentId: null,
  categoryId: null,
  title: "",
  description: "",
  condition: null,
  currency: "ARS",
  price: "",
  department: "",
  location: "",
};

// --- Precio -------------------------------------------------------------------

export type ParsedPrice = { ok: true; value: string | null } | { ok: false };

/**
 * Normaliza un precio escrito en formato argentino a la forma que acepta la
 * API ("480000", "15900.5"). Vacío = "Precio a consultar" (null).
 * Acepta "480.000", "480000", "15.900,50", "15900,5" y "15900.50".
 */
export function parsePrice(raw: string): ParsedPrice {
  const text = raw.replace(/\s|\$|US/gi, "");
  if (text === "") return { ok: true, value: null };
  if (!/^[\d.,]+$/.test(text)) return { ok: false };

  let normalized: string;
  if (text.includes(",")) {
    // La coma es el separador decimal; los puntos, de miles.
    if (text.split(",").length > 2) return { ok: false };
    normalized = text.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    normalized = text.replace(/\./g, "");
  } else {
    normalized = text;
  }

  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) return { ok: false };
  const integer = match[1].replace(/^0+(?=\d)/, "");
  // max_digits=14 con 2 decimales en el backend.
  if (integer.length > 12) return { ok: false };
  const decimals = match[2]?.replace(/0+$/, "");
  return { ok: true, value: decimals ? `${integer}.${decimals}` : integer };
}

// --- Validación por paso --------------------------------------------------------

export function validateCategory(
  draft: ListingDraft,
  tree: CategoryNode[] = [],
): DraftErrors {
  if (draft.categoryId) return {};
  const parent = tree.find((c) => c.id === draft.parentId);
  if (parent && parent.children.length > 0) {
    return { category: `Elegí una subcategoría de ${parent.name}.` };
  }
  return { category: "Elegí una categoría para tu aviso." };
}

export function validateDetails(draft: ListingDraft): DraftErrors {
  const errors: DraftErrors = {};
  const title = draft.title.trim();
  const description = draft.description.trim();
  if (title.length < TITLE_MIN) {
    errors.title = `Escribí un título de al menos ${TITLE_MIN} caracteres.`;
  } else if (title.length > TITLE_MAX) {
    errors.title = `El título puede tener hasta ${TITLE_MAX} caracteres.`;
  }
  if (description.length < DESCRIPTION_MIN) {
    errors.description = `Contá un poco más: al menos ${DESCRIPTION_MIN} caracteres.`;
  } else if (description.length > DESCRIPTION_MAX) {
    errors.description = `La descripción puede tener hasta ${DESCRIPTION_MAX} caracteres.`;
  }
  return errors;
}

export function validatePricing(draft: ListingDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (!parsePrice(draft.price).ok) {
    errors.price =
      "Escribí el precio solo con números, por ejemplo 480.000 o 15900,50.";
  }
  if (!(DEPARTMENTS as readonly string[]).includes(draft.department)) {
    errors.department = "Elegí el departamento donde está lo que vendés.";
  }
  if (draft.location.trim().length > LOCATION_MAX) {
    errors.location = `La localidad puede tener hasta ${LOCATION_MAX} caracteres.`;
  }
  return errors;
}

export function validateDraft(
  draft: ListingDraft,
  tree: CategoryNode[] = [],
): DraftErrors {
  return {
    ...validateCategory(draft, tree),
    ...validateDetails(draft),
    ...validatePricing(draft),
  };
}

export function hasErrors(errors: DraftErrors): boolean {
  return Object.keys(errors).length > 0;
}

// --- Conversión con la API --------------------------------------------------------

/** Cuerpo de POST/PUT /listings. Asume un borrador ya validado. */
export function toListingInput(draft: ListingDraft): ListingInput {
  const price = parsePrice(draft.price);
  const location = draft.location.trim();
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    category_id: draft.categoryId ?? "",
    price: price.ok ? price.value : null,
    price_currency: draft.currency,
    condition: draft.condition === "na" ? null : draft.condition,
    department: draft.department,
    location: location === "" ? null : location,
  };
}

/** "480000.00" → "480.000"; "15900.50" → "15.900,50" (para editar). */
export function priceToInput(price: string | null): string {
  if (price === null || price === "") return "";
  const [integer, decimals = ""] = price.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const cents = decimals.replace(/0+$/, "");
  return cents ? `${grouped},${cents.padEnd(2, "0")}` : grouped;
}

export function draftFromListing(listing: OwnerListing): ListingDraft {
  return {
    parentId: listing.category.parent_id,
    categoryId: listing.category.id,
    title: listing.title,
    description: listing.description,
    condition: listing.condition ?? "na",
    currency: listing.price_currency,
    price: priceToInput(listing.price),
    department: listing.department ?? "",
    location: listing.location ?? "",
  };
}

// --- Categorías ------------------------------------------------------------------

/** Camino [padre, hija] (o [categoría]) para mostrar "Vehículos › Autos". */
export function categoryPath(
  tree: CategoryNode[],
  categoryId: string | null,
): CategoryNode[] {
  if (!categoryId) return [];
  for (const parent of tree) {
    if (parent.id === categoryId) return [parent];
    const child = parent.children.find((c) => c.id === categoryId);
    if (child) return [parent, child];
  }
  return [];
}
