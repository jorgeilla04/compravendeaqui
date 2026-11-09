import { cn } from "@/lib/utils";
import { initials, readableText } from "@/lib/uniformes/color";
import type { Colegio } from "@/lib/uniformes/types";

/**
 * Escudo oficial del colegio o, hasta tenerlo (con autorización), un recuadro
 * provisorio con sus iniciales y sus colores.
 */
export function Escudo({
  colegio,
  size = "md",
  className,
}: {
  colegio: Pick<Colegio, "nombre" | "color1" | "color2" | "logo_url">;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const box = {
    sm: "size-10 text-meta",
    md: "size-14 text-base",
    lg: "size-20 text-h3",
  }[size];
  if (colegio.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- escudo chico desde el bucket
      <img
        src={colegio.logo_url}
        alt={`Escudo de ${colegio.nombre}`}
        className={cn(
          box,
          "shrink-0 rounded-input bg-card object-contain",
          className,
        )}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        box,
        "inline-flex shrink-0 items-center justify-center rounded-input border-2 font-heading font-bold tracking-wide",
        className,
      )}
      style={{
        backgroundColor: colegio.color1,
        borderColor: colegio.color2,
        color: readableText(colegio.color1),
      }}
    >
      {initials(colegio.nombre)}
    </span>
  );
}
