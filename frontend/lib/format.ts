import type { Condition, Currency } from "@/lib/types";

const number = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

/** "US$ 15.900" o "$ 480.000" — la moneda siempre visible y sin ambigüedad. */
export function formatPrice(
  price: string | number | null,
  currency: Currency,
): string {
  if (price === null || price === "") return "Precio a consultar";
  const value = typeof price === "string" ? Number(price) : price;
  return `${currency === "USD" ? "US$" : "$"} ${number.format(value)}`;
}

export function conditionLabel(condition: Condition | null): string | null {
  if (!condition) return null;
  return condition.charAt(0).toUpperCase() + condition.slice(1);
}

const dateFmt = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

/** "hace 3 días", "hoy". */
export function relativeDays(iso: string, now: Date = new Date()): string {
  const days = Math.floor(
    (now.getTime() - new Date(iso).getTime()) / 86_400_000,
  );
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} días`;
  const months = Math.floor(days / 30);
  return months === 1 ? "hace 1 mes" : `hace ${months} meses`;
}

export function memberSince(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  }).format(d);
}
