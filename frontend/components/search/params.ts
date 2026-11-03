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
