/** Utilidades de color para fichas con los colores de cada colegio. */

function channel(hex: string, start: number): number {
  const c = parseInt(hex.slice(start, start + 2), 16) / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return 0;
  return (
    0.2126 * channel(hex, 1) +
    0.7152 * channel(hex, 3) +
    0.0722 * channel(hex, 5)
  );
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Texto legible (AA) sobre un fondo de color: blanco o casi negro. */
export function readableText(bg: string): string {
  return contrast(bg, "#FFFFFF") >= contrast(bg, "#0F172A")
    ? "#FFFFFF"
    : "#0F172A";
}

const STOP = new Set([
  "colegio",
  "escuela",
  "instituto",
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "y",
  "e",
  "n°",
  "nº",
]);

/** "Colegio Santa Rosa de Lima" → "SRL" (escudo provisorio). */
export function initials(nombre: string): string {
  const words = nombre
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w.toLowerCase()) && /\p{L}/u.test(w));
  return (words.length ? words : nombre.split(/\s+/))
    .slice(0, 3)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
