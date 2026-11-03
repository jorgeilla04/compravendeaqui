/** Constantes de dominio (espejo de backend/app/core/constants.py). */

export const DEPARTMENTS = [
  "Albardón",
  "Angaco",
  "Calingasta",
  "Capital",
  "Caucete",
  "Chimbas",
  "Iglesia",
  "Jáchal",
  "Nueve de Julio",
  "Pocito",
  "Rawson",
  "Rivadavia",
  "San Martín",
  "Santa Lucía",
  "Sarmiento",
  "Ullum",
  "Valle Fértil",
  "Veinticinco de Mayo",
  "Zonda",
] as const;

export const CONDITIONS = [
  { value: "nuevo", label: "Nuevo" },
  { value: "usado", label: "Usado" },
  { value: "reacondicionado", label: "Reacondicionado" },
] as const;

export const SORTS = [
  { value: "relevance", label: "Más relevantes" },
  { value: "newest", label: "Más recientes" },
  { value: "price_asc", label: "Menor precio" },
  { value: "price_desc", label: "Mayor precio" },
] as const;

export const STATUS_LABELS: Record<string, string> = {
  active: "Publicado",
  draft: "Borrador",
  sold: "Vendido",
  expired: "Vencido",
  suspended: "Suspendido",
};

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const SITE_NAME = "CompraVendeAqui";
