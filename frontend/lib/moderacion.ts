export interface Dueno {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
  is_active: boolean;
}

export interface AvisoMod {
  id: string;
  title: string;
  status: string;
  price: string | null;
  price_currency: "ARS" | "USD";
  url_path: string;
  thumb_url: string | null;
  created_at: string;
  moderation_reason: string | null;
  dueno: Dueno;
}

export interface UsuarioMod {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
  role: string;
  is_active: boolean;
  suspension_reason: string | null;
  avisos_activos: number;
  created_at: string;
}

export interface HistorialMod {
  id: number;
  actor: string | null;
  target_type: "listing" | "user";
  target_id: string;
  target_label: string;
  action: "suspend" | "restore";
  reason: string | null;
  created_at: string;
}

export const ESTADOS_AVISO: Record<string, string> = {
  active: "Activo",
  draft: "Borrador",
  sold: "Vendido",
  expired: "Vencido",
  suspended: "Suspendido",
};

export function puedeModerar(role: string | undefined): boolean {
  return role === "admin" || role === "moderator";
}
