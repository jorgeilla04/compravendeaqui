/** Tipos de las tiendas virtuales (espejo de app/schemas/tiendas.py). */

export type Entrega = "estandar" | "express" | "retiro";
export type ModalidadPago = "sena" | "total";
export type EstadoPedido =
  | "pendiente_pago"
  | "pagado"
  | "rechazado"
  | "a_coordinar"
  | "en_preparacion"
  | "entregado"
  | "cancelado";

export interface TiendaResumen {
  slug: string;
  nombre: string;
  descripcion: string | null;
}

export interface Grupo {
  slug: string;
  nombre: string;
  subtitulo: string | null;
  categoria: string | null;
  color1: string;
  color2: string;
  logo_url: string | null;
}

/** Config de cobro y entrega de la tienda (la usan el carrito y la cotización). */
export interface TiendaReglas {
  entregas: Entrega[];
  modalidades: ModalidadPago[];
  envio_monto: string;
  envio_gratis_desde: string | null;
  envio_demora: string;
  departamentos_envio: string[];
  express_recargo_pct: number;
  express_monto: string;
  express_demora: string;
  retiro_direccion: string | null;
  sena_pct: number;
}

export interface Tienda extends TiendaResumen, TiendaReglas {
  grupo_label: string;
  opcion_label: string;
  categorias: string[];
  vendedor_nombre: string;
  whatsapp_url: string;
  pagos_online: boolean;
  grupos: Grupo[];
}

export interface Producto {
  slug: string;
  nombre: string;
  descripcion: string | null;
  tipo: string;
  precio: string;
  opciones: string[];
  foto_url: string | null;
}

export interface GrupoDetalle extends Grupo {
  /** Fotos del uniforme completo (galería). */
  fotos: string[];
  productos: Producto[];
}

export interface PedidoItem {
  grupo_nombre: string;
  producto_nombre: string;
  opcion: string | null;
  cantidad: number;
  precio_unit: string;
}

export interface Pedido {
  id: string;
  codigo: string;
  tienda: TiendaResumen;
  opcion_label: string;
  estado: EstadoPedido;
  entrega: Entrega;
  entrega_label: string;
  modalidad_pago: ModalidadPago;
  subtotal: string;
  envio_monto: string;
  recargo_express: string;
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
  direccion: string | null;
  departamento: string | null;
  notas: string | null;
  mp_payment_id: string | null;
  notificado_at: string | null;
  cliente_whatsapp_url: string;
}

export interface PedidoCreado {
  pedido: Pedido;
  init_point: string | null;
}

/** Lo que edita el dueño de la tienda (PUT /admin/tiendas/:slug). */
export interface TiendaConfig {
  nombre: string;
  descripcion: string | null;
  grupo_label: string;
  opcion_label: string;
  categorias: string[];
  productos_en_todos: boolean;
  activo: boolean;
  vendedor_nombre: string;
  vendedor_email: string;
  vendedor_whatsapp: string;
  envio_habilitado: boolean;
  envio_monto: string;
  envio_gratis_desde: string | null;
  envio_demora: string;
  departamentos_envio: string[];
  express_habilitado: boolean;
  express_recargo_pct: number;
  express_monto: string;
  express_demora: string;
  retiro_habilitado: boolean;
  retiro_direccion: string | null;
  sena_habilitada: boolean;
  sena_pct: number;
  total_habilitado: boolean;
}

export interface TiendaAdmin extends TiendaConfig {
  slug: string;
}

export interface GrupoAdmin extends Grupo {
  activo: boolean;
  fotos: string[];
}

export interface ProductoAdmin {
  slug: string;
  nombre: string;
  descripcion: string | null;
  tipo: string;
  precio_base: string;
  opciones: string[];
  foto_url: string | null;
  orden: number;
  activo: boolean;
}

export interface PrecioGrupo {
  grupo: string;
  producto: string;
  precio: string | null;
  disponible: boolean;
  /** Foto del producto en este grupo (null = la foto general). */
  foto_url?: string | null;
}

export interface CatalogoAdmin {
  tienda: TiendaAdmin;
  grupos: GrupoAdmin[];
  productos: ProductoAdmin[];
  precios: PrecioGrupo[];
}

export interface Encargado {
  id: string;
  email: string | null;
  nombre: string;
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

export const TIPOS_ILUSTRACION: Record<string, string> = {
  generico: "Genérico",
  remera: "Remera / chomba",
  pantalon: "Pantalón",
  pollera: "Pollera",
  corbata: "Corbata",
  buzo: "Buzo / sweater",
  campera: "Campera",
  bermuda: "Bermuda / short",
  jogging: "Jogging",
};
