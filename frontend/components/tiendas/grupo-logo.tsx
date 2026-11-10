import { cn } from "@/lib/utils";
import { initials, readableText } from "@/lib/tiendas/color";
import type { Grupo } from "@/lib/tiendas/types";

/**
 * Logo del grupo (escudo del colegio, por ejemplo) o, mientras no tenga uno,
 * un recuadro con sus iniciales y sus colores.
 */
export function GrupoLogo({
  grupo,
  size = "md",
  className,
}: {
  grupo: Pick<Grupo, "nombre" | "color1" | "color2" | "logo_url">;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const box = {
    sm: "size-10 text-meta",
    md: "size-14 text-base",
    lg: "size-20 text-h3",
  }[size];
  if (grupo.logo_url) {
    // Más ancho que el provisorio: muchos logos son apaisados (escudo + nombre)
    // y en un cuadrado quedarían ilegibles. object-contain no recorta.
    const logoBox = {
      sm: "h-10 w-20",
      md: "h-14 w-28",
      lg: "h-20 w-40",
    }[size];
    return (
      // eslint-disable-next-line @next/next/no-img-element -- logo chico desde el bucket
      <img
        src={grupo.logo_url}
        alt={`Logo de ${grupo.nombre}`}
        className={cn(
          logoBox,
          "shrink-0 rounded-input object-contain",
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
        backgroundColor: grupo.color1,
        borderColor: grupo.color2,
        color: readableText(grupo.color1),
      }}
    >
      {initials(grupo.nombre)}
    </span>
  );
}
