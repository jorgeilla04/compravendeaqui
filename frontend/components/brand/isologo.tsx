import { cn } from "@/lib/utils";

/** Trazos del isologo en un lienzo de 120×120 (los usan también los íconos). */
export const PIN =
  "M60 110 C60 110 22 72 22 46 A38 38 0 0 1 98 46 C98 72 60 110 60 110 Z";
export const ETIQUETA =
  "M40 34 L68 34 L82 46 L68 58 L40 58 Q36 58 36 54 L36 38 Q36 34 40 34 Z";

/**
 * Isologo de CompraVendeAqui: un pin de ubicación (el "Aquí") con una
 * etiqueta de precio adentro. Arenisca y ocre de Ischigualasto.
 */
export function Isologo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="20 6 80 106"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <path d={PIN} className="fill-primary" />
      <g transform="rotate(-40 60 46)">
        <path d={ETIQUETA} className="fill-accent" />
        <circle cx="70" cy="46" r="4" className="fill-primary" />
      </g>
    </svg>
  );
}
