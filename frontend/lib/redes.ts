export type Red = "facebook" | "instagram";

export interface Publicacion {
  id: string;
  listing_id: string | null;
  producto_id: string | null;
  grupo_id: string | null;
  red: Red;
  estado: "pendiente" | "publicada" | "error";
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
};

export const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
