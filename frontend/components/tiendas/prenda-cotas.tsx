import * as React from "react";

/**
 * Figura de la prenda con flechas de cota numeradas para cada medida de la
 * guía de talles, en un lienzo de 200×200. Las columnas se reconocen por su
 * nombre (largo, pecho, manga, cintura, entrepierna); las que no se reconocen
 * quedan solo en la tabla.
 */

export type Cota = "largo" | "pecho" | "manga" | "cintura" | "entrepierna";

/** Extremos de la flecha; `t` ubica la etiqueta a lo largo (0.5: al medio). */
type Linea = { x1: number; y1: number; x2: number; y2: number; t?: number };

type Figura = {
  forma: React.ReactNode;
  cotas: Partial<Record<Cota, Linea>>;
};

const prenda = "fill-muted stroke-muted-foreground";
const detalle = "fill-none stroke-muted-foreground";

const SUPERIOR_LARGA = (
  <path
    className={prenda}
    d="M66 24 L84 18 Q100 32 116 18 L134 24 L170 70 L176 150 L156 152 L148 84 L136 78 L136 182 L64 182 L64 78 L52 84 L44 152 L24 150 L30 70 Z"
  />
);

const FIGURAS: Record<string, Figura> = {
  remera: {
    forma: (
      <>
        <path
          className={prenda}
          d="M70 24 L86 18 Q100 30 114 18 L130 24 L162 52 L146 72 L134 62 L134 182 L66 182 L66 62 L54 72 L38 52 Z"
        />
        <path className={detalle} d="M86 18 Q100 36 114 18" />
      </>
    ),
    cotas: {
      largo: { x1: 126, y1: 22, x2: 126, y2: 182, t: 0.72 },
      pecho: { x1: 66, y1: 76, x2: 134, y2: 76 },
    },
  },
  buzo: {
    forma: (
      <>
        {SUPERIOR_LARGA}
        <path className={detalle} d="M84 18 Q100 38 116 18" />
        <path
          className={detalle}
          d="M64 172 L136 172 M44 142 L25 141 M156 143 L175 142"
        />
      </>
    ),
    cotas: {
      largo: { x1: 126, y1: 22, x2: 126, y2: 182, t: 0.72 },
      pecho: { x1: 64, y1: 86, x2: 136, y2: 86 },
      manga: { x1: 138, y1: 22, x2: 178, y2: 150, t: 0.62 },
    },
  },
  campera: {
    forma: (
      <>
        {SUPERIOR_LARGA}
        <path className={detalle} d="M84 18 L100 30 L116 18 M100 30 L100 182" />
      </>
    ),
    cotas: {
      largo: { x1: 126, y1: 22, x2: 126, y2: 182, t: 0.72 },
      pecho: { x1: 64, y1: 86, x2: 136, y2: 86 },
      manga: { x1: 138, y1: 22, x2: 178, y2: 150, t: 0.62 },
    },
  },
  pantalon: {
    forma: (
      <>
        <path
          className={prenda}
          d="M64 20 L136 20 L146 186 L108 186 L100 72 L92 186 L54 186 Z"
        />
        <path className={detalle} d="M64 32 L136 32" />
      </>
    ),
    cotas: {
      cintura: { x1: 64, y1: 26, x2: 136, y2: 26 },
      largo: { x1: 168, y1: 20, x2: 168, y2: 186 },
      entrepierna: { x1: 100, y1: 74, x2: 100, y2: 186 },
    },
  },
  pollera: {
    forma: (
      <>
        <path className={prenda} d="M70 30 L130 30 L156 150 L44 150 Z" />
        <path
          className={detalle}
          d="M70 42 L130 42 M85 42 L76 150 M100 42 L100 150 M115 42 L124 150"
        />
      </>
    ),
    cotas: {
      cintura: { x1: 70, y1: 36, x2: 130, y2: 36 },
      largo: { x1: 172, y1: 30, x2: 172, y2: 150 },
    },
  },
  bermuda: {
    forma: (
      <>
        <path
          className={prenda}
          d="M62 34 L138 34 L148 140 L106 140 L100 92 L94 140 L52 140 Z"
        />
        <path className={detalle} d="M62 46 L138 46" />
      </>
    ),
    cotas: {
      cintura: { x1: 62, y1: 40, x2: 138, y2: 40 },
      largo: { x1: 166, y1: 34, x2: 166, y2: 140 },
    },
  },
};
FIGURAS.jogging = FIGURAS.pantalon;

/** Qué cota dibuja una columna de la guía, según su nombre. */
export function cotaDe(columna: string): Cota | null {
  const n = columna.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (n.includes("manga")) return "manga";
  if (n.includes("entrepierna")) return "entrepierna";
  if (n.includes("cintura")) return "cintura";
  if (n.includes("pecho") || n.includes("ancho")) return "pecho";
  if (n.includes("largo")) return "largo";
  return null;
}

export function tieneFigura(tipo: string) {
  return tipo in FIGURAS;
}

export type Medida = { numero: number; cota: Cota; valor: string };

/** Figura de la prenda con una flecha numerada y los cm de cada medida. */
export function PrendaCotas({
  tipo,
  medidas,
  className,
}: {
  tipo: string;
  medidas: Medida[];
  className?: string;
}) {
  const id = React.useId();
  const figura = FIGURAS[tipo];
  if (!figura) return null;
  const flecha = `${id}-flecha`;
  return (
    <svg
      viewBox="0 0 200 200"
      aria-hidden="true"
      className={className}
      strokeWidth={1.5}
      strokeLinejoin="round"
    >
      <defs>
        <marker
          id={flecha}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M0 0 L10 5 L0 10 Z" className="fill-primary" />
        </marker>
      </defs>
      {figura.forma}
      {medidas.map(({ numero, cota }) => {
        const l = figura.cotas[cota];
        if (!l) return null;
        return (
          <line
            key={numero}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            className="stroke-primary"
            strokeWidth={1.75}
            markerStart={`url(#${flecha})`}
            markerEnd={`url(#${flecha})`}
          />
        );
      })}
      {medidas.map(({ numero, cota, valor }) => {
        const l = figura.cotas[cota];
        if (!l) return null;
        const t = l.t ?? 0.5;
        const x = l.x1 + (l.x2 - l.x1) * t;
        const y = l.y1 + (l.y2 - l.y1) * t;
        const ancho = 22 + valor.length * 6.2;
        return (
          <g key={numero} transform={`translate(${x} ${y})`}>
            <rect
              x={-ancho / 2}
              y={-9}
              width={ancho}
              height={18}
              rx={9}
              className="fill-card stroke-primary"
            />
            <circle
              cx={-ancho / 2 + 9}
              cy={0}
              r={6.5}
              className="fill-primary"
            />
            <text
              x={-ancho / 2 + 9}
              y={3.5}
              textAnchor="middle"
              className="fill-primary-foreground text-[9px] font-bold"
            >
              {numero}
            </text>
            <text
              x={-ancho / 2 + 18}
              y={4}
              className="fill-foreground text-[11px] font-semibold tabular-nums"
            >
              {valor}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
