/** Tipos de la tienda de uniformes (espejo de app/schemas/uniformes.py). */

export type CategoriaSlug = "parroquiales" | "privados" | "preuniversitarios";
export type Envio = "estandar" | "express";
export type ModalidadPago = "sena" | "total";
export type EstadoPedido =
  | "pendiente_pago"
  | "pagado"
  | "rechazado"
  | "a_coordinar"
  | "en_preparacion"
  | "entregado"
  | "cancelado";

export interface Categoria {
  slug: CategoriaSlug;
  nombre: string;
}

export interface Colegio {
  slug: string;
  nombre: string;
  departamento: string;
  categoria: CategoriaSlug;
  color1: string;
  color2: string;
  logo_url: string | null;
}

export interface Prenda {
  slug: string;
  nombre: string;
  tipo: string;
  precio: string;
  talles: string[];
  foto_url: string | null;
}

export interface ColegioDetalle extends Colegio {
  prendas: Prenda[];
}

export interface TiendaConfig {
  envio_monto: number;
  express_recargo_pct: number;
  sena_pct: number;
  departamentos_envio: string[];
  pagos_online: boolean;
  vendedora_nombre: string;
  vendedora_whatsapp_url: string;
  retiro_direccion: string;
}

export interface Catalogo {
  categorias: Categoria[];
  colegios: Colegio[];
  config: TiendaConfig;
}

export interface PedidoItem {
  colegio_nombre: string;
  prenda_nombre: string;
  talle: string;
  cantidad: number;
  precio_unit: string;
}

export interface Pedido {
  id: string;
  codigo: string;
  estado: EstadoPedido;
  envio: Envio;
  modalidad_pago: ModalidadPago;
  subtotal: string;
  recargo_express: string;
  envio_monto: string;
  total: string;
  pagado_ahora: string;
  saldo: string;
  items: PedidoItem[];
  cliente_nombre: string;
  created_at: string;
  pagado_at: string | null;
  whatsapp_url: string;
  pago_url: string | null;
}

export interface PedidoAdmin extends Pedido {
  cliente_tel: string;
  cliente_email: string | null;
  direccion: string;
  departamento: string;
  notas: string | null;
  mp_payment_id: string | null;
  notificado_at: string | null;
  cliente_whatsapp_url: string;
}

export interface PedidoCreado {
  pedido: Pedido;
  init_point: string | null;
}

export const ESTADO_LABEL: Record<EstadoPedido, string> = {
  pendiente_pago: "Pendiente de pago",
  pagado: "Pagado",
  rechazado: "Pago rechazado",
  a_coordinar: "A coordinar por WhatsApp",
  en_preparacion: "En preparación",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export interface ColegioAdmin extends Colegio {
  activo: boolean;
}

export interface PrendaAdmin {
  slug: string;
  nombre: string;
  tipo: string;
  precio_base: string;
  talles: string[];
  foto_url: string | null;
  activo: boolean;
}

export interface PrecioColegio {
  colegio: string;
  prenda: string;
  precio: string | null;
  disponible: boolean;
}

export interface CatalogoAdmin {
  colegios: ColegioAdmin[];
  prendas: PrendaAdmin[];
  precios: PrecioColegio[];
}
