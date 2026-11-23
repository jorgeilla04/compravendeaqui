export type Red = "facebook" | "instagram";

export interface Publicacion {
  id: string;
  listing_id: string | null;
  producto_id: string | null;
  grupo_id: string | null;
  red: Red;
  estado: "pendiente" | "publicada" | "error" | "eliminada";
  texto: string;
  imagen_url: string | null;
  permalink: string | null;
  error: string | null;
  created_at: string;
  publicada_at: string | null;
}

export interface PublicacionListado extends Publicacion {
  aviso_titulo: string;
  aviso_url: string;
}

export interface AvisoRedes {
  textos: Record<Red, string>;
  conectadas: Record<Red, boolean>;
  publicaciones: Publicacion[];
}

export const REDES: { id: Red; nombre: string }[] = [
  { id: "facebook", nombre: "Facebook" },
  { id: "instagram", nombre: "Instagram" },
];

export const ESTADO_LABEL: Record<Publicacion["estado"], string> = {
  pendiente: "Publicando…",
  publicada: "Publicada",
  error: "Error",
  eliminada: "Eliminada",
};

export const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export interface Programacion {
  id: string;
  fecha: string; // YYYY-MM-DD
  orden: number;
  publicar_at: string;
  titulo: string;
  tipo: "aviso" | "uniforme";
  vista_previa: string | null;
  redes: Red[];
  estado: "programada" | "publicando" | "publicada" | "error";
  error: string | null;
  publicaciones: Publicacion[];
}

export const MAX_POR_DIA = 3;

export const ESTADO_PROGRAMACION: Record<Programacion["estado"], string> = {
  programada: "Programada",
  publicando: "Publicando…",
  publicada: "Publicada",
  error: "Error",
};

/** Fecha YYYY-MM-DD de hoy + n días (en la hora del navegador). */
export function diaISO(n: number, base = new Date()): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** "Martes 24 de noviembre" a partir de YYYY-MM-DD. */
export function diaLargo(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const texto = new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Hora de San Juan (UTC-3) de una fecha ISO: "19:00". */
export function horaSanJuan(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Argentina/San_Juan",
  });
}
