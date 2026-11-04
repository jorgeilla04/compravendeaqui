import { CONDITIONS, DEPARTMENTS } from "@/lib/constants";
import type { Sort } from "@/lib/types";

/** Parámetros de búsqueda que viajan en la URL (/buscar?q=…&department=…). */
export interface SearchFilters {
  q?: string;
  category?: string;
  department?: string;
  condition?: string;
  currency?: string;
  price_min?: string;
  price_max?: string;
  sort?: Sort;
}

const KEYS = [
  "q",
  "category",
  "department",
  "condition",
  "currency",
  "price_min",
  "price_max",
  "sort",
] as const;

const SORTS: Sort[] = ["relevance", "newest", "price_asc", "price_desc"];
const ENUMS: Partial<Record<keyof SearchFilters, readonly string[]>> = {
  department: DEPARTMENTS,
  condition: CONDITIONS.map((c) => c.value),
  currency: ["ARS", "USD"],
};

export function parseFilters(
  raw: Record<string, string | string[] | undefined>,
): SearchFilters {
  const filters: SearchFilters = {};
  for (const key of KEYS) {
    const value = raw[key];
    const text = (Array.isArray(value) ? value[0] : value)?.trim();
    if (!text) continue;
    if (key === "sort") {
      if (SORTS.includes(text as Sort)) filters.sort = text as Sort;
    } else if (key === "price_min" || key === "price_max") {
      if (/^\d+(\.\d+)?$/.test(text)) filters[key] = text;
    } else if (ENUMS[key]) {
      // Valores fuera de la lista se descartan (no son filtros válidos).
      if (ENUMS[key]!.includes(text)) filters[key] = text;
    } else {
      filters[key] = text.slice(0, 120);
    }
  }
  return filters;
}

export function toQueryString(
  filters: SearchFilters,
  omit: (keyof SearchFilters)[] = [],
): string {
  const params = new URLSearchParams();
  for (const key of KEYS) {
    const value = filters[key];
    if (value && !omit.includes(key)) params.set(key, value);
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** Query para la API: sin q usa /listings (orden por fecha), con q /search. */
export function apiQuery(
  filters: SearchFilters,
): Record<string, string | undefined> {
  return {
    ...filters,
    sort: filters.sort ?? (filters.q ? "relevance" : "newest"),
  };
}

export function endpointFor(filters: SearchFilters): "/search" | "/listings" {
  return filters.q ? "/search" : "/listings";
}

/**
 * Segundos de caché del servidor para estos filtros. Solo se cachea cuando el
 * espacio de combinaciones es acotado (departamento, condición, moneda, orden y
 * un rubro verificado): con texto libre, rango de precio o un rubro arbitrario
 * cada URL sería una entrada nueva.
 */
export function cacheSeconds(
  filters: SearchFilters,
  { categoryVerified = false }: { categoryVerified?: boolean } = {},
): number | false {
  // La categoría solo cuenta como acotada si la página ya verificó que existe.
  const unbounded =
    filters.q ||
    filters.price_min ||
    filters.price_max ||
    (filters.category && !categoryVerified);
  return unbounded ? false : 5;
}
