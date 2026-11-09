/**
 * Ilustración de cada prenda con los colores del colegio, hasta tener fotos
 * reales. Formas planas en un lienzo de 120×120.
 */

const OUTLINE = "rgba(15, 23, 42, 0.35)";

function Shape({ tipo, c1, c2 }: { tipo: string; c1: string; c2: string }) {
  const stroke = {
    stroke: OUTLINE,
    strokeWidth: 2,
    strokeLinejoin: "round" as const,
  };
  switch (tipo) {
    case "remera":
      return (
        <>
          <path
            d="M38 22 L52 16 Q60 24 68 16 L82 22 L102 40 L90 54 L82 48 L82 104 L38 104 L38 48 L30 54 L18 40 Z"
            fill={c1}
            {...stroke}
          />
          <path
            d="M52 16 Q60 30 68 16 L64 15 Q60 22 56 15 Z"
            fill={c2}
            {...stroke}
          />
          <path d="M60 24 L60 40" stroke={c2} strokeWidth={3} />
        </>
      );
    case "buzo":
      return (
        <>
          <path
            d="M36 22 L50 16 Q60 26 70 16 L84 22 L104 46 L104 98 L92 98 L92 56 L84 52 L84 104 L36 104 L36 52 L28 56 L28 98 L16 98 L16 46 Z"
            fill={c1}
            {...stroke}
          />
          <path
            d="M50 16 Q60 30 70 16"
            fill="none"
            stroke={c2}
            strokeWidth={4}
          />
          <rect x="36" y="96" width="48" height="8" fill={c2} {...stroke} />
        </>
      );
    case "campera":
      return (
        <>
          <path
            d="M36 20 L50 14 L60 22 L70 14 L84 20 L104 46 L104 100 L92 100 L92 56 L84 52 L84 106 L36 106 L36 52 L28 56 L28 100 L16 100 L16 46 Z"
            fill={c1}
            {...stroke}
          />
          <path d="M60 22 L60 106" stroke={c2} strokeWidth={3} />
          <path
            d="M50 14 L60 22 L70 14 L66 30 L60 26 L54 30 Z"
            fill={c2}
            {...stroke}
          />
          <rect x="42" y="72" width="12" height="4" rx="2" fill={c2} />
          <rect x="66" y="72" width="12" height="4" rx="2" fill={c2} />
        </>
      );
    case "pantalon":
    case "jogging":
      return (
        <>
          <path
            d="M38 14 L82 14 L88 108 L66 108 L60 46 L54 108 L32 108 Z"
            fill={c1}
            {...stroke}
          />
          <rect
            x="38"
            y="14"
            width="44"
            height="8"
            fill={tipo === "jogging" ? c2 : c1}
            {...stroke}
          />
          {tipo === "jogging" ? (
            <>
              <path d="M40 24 L35 106" stroke={c2} strokeWidth={4} />
              <path d="M80 24 L85 106" stroke={c2} strokeWidth={4} />
              <rect
                x="32"
                y="100"
                width="22"
                height="8"
                fill={c2}
                {...stroke}
              />
              <rect
                x="66"
                y="100"
                width="22"
                height="8"
                fill={c2}
                {...stroke}
              />
            </>
          ) : (
            <path d="M60 22 L60 46" stroke={OUTLINE} strokeWidth={2} />
          )}
        </>
      );
    case "bermuda":
      return (
        <>
          <path
            d="M36 26 L84 26 L92 86 L66 90 L60 56 L54 90 L28 86 Z"
            fill={c1}
            {...stroke}
          />
          <rect x="36" y="26" width="48" height="8" fill={c2} {...stroke} />
        </>
      );
    case "pollera":
      return (
        <>
          <path d="M40 24 L80 24 L98 96 L22 96 Z" fill={c1} {...stroke} />
          <rect x="40" y="20" width="40" height="9" fill={c2} {...stroke} />
          {[34, 46, 58, 70, 82].map((x) => (
            <path
              key={x}
              d={`M${x + (60 - x) * 0.55} 29 L${x} 96`}
              stroke={OUTLINE}
              strokeWidth={1.5}
            />
          ))}
        </>
      );
    case "corbata":
      return (
        <>
          <path d="M50 14 L70 14 L66 28 L54 28 Z" fill={c1} {...stroke} />
          <path
            d="M54 28 L66 28 L76 88 L60 106 L44 88 Z"
            fill={c1}
            {...stroke}
          />
          <path
            d="M57 44 L71 58 M51 62 L74 84 M47 80 L58 91"
            stroke={c2}
            strokeWidth={4}
          />
        </>
      );
    default:
      return (
        <rect
          x="24"
          y="24"
          width="72"
          height="72"
          rx="12"
          fill={c1}
          {...stroke}
        />
      );
  }
}

export function PrendaIlustracion({
  tipo,
  color1,
  color2,
  className,
}: {
  tipo: string;
  color1: string;
  color2: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 120 120"
      role="presentation"
      aria-hidden="true"
      className={className}
    >
      <Shape tipo={tipo} c1={color1} c2={color2} />
    </svg>
  );
}
