import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge no conoce la escala tipográfica propia (tailwind.config.ts):
 * sin esto trata `text-meta`/`text-h3` como colores y descarta el
 * `text-*-foreground` del botón, rompiendo el contraste.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["meta", "h3", "h2", "h1", "display"] }],
    },
  },
});

/** Combina clases condicionales resolviendo conflictos de Tailwind. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
