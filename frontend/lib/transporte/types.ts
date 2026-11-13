export interface Lugar {
  nombre: string;
  detalle?: string;
  lat: number;
  lon: number;
}

export interface Unidad {
  id: string;
  nombre: string;
  asientos: number;
  foto_url: string | null;
}

export interface Transportista {
  slug: string;
  nombre: string;
  descripcion: string | null;
  foto_url: string | null;
  iva_incluido: boolean;
  whatsapp_url: string;
  unidades: Unidad[];
}

export interface Viaje {
  origen: Lugar;
  destino: Lugar;
  pasajeros: number;
  ida_vuelta: boolean;
  horas_espera: number;
}

export interface Opcion {
  unidad_id: string;
  unidad: string;
  asientos: number;
  foto_url: string | null;
  cantidad: number;
  precio: string;
}

export interface Cotizacion {
  km: string;
  km_cobrados: string;
  iva_incluido: boolean;
  opciones: Opcion[];
}

export interface PedidoCreado {
  codigo: string;
  total: string;
  whatsapp_url: string;
}

export type EstadoTransporte =
  | "nuevo"
  | "confirmado"
  | "realizado"
  | "cancelado";

export interface PedidoTransporte {
  id: string;
  codigo: string;
  estado: EstadoTransporte;
  nombre: string;
  email: string;
  telefono: string;
  empresa: string;
  origen: string;
  destino: string;
  km: string;
  ida_vuelta: boolean;
  fecha: string | null;
  horas_espera: number;
  pasajeros: number;
  unidad: string;
  cantidad_unidades: number;
  total: string;
  notas: string | null;
  created_at: string;
}

export interface UnidadAdmin extends Unidad {
  precio_km: string;
  activo: boolean;
}

export interface TransportistaAdmin {
  slug: string;
  nombre: string;
  descripcion: string | null;
  foto_url: string | null;
  whatsapp: string;
  email: string;
  minimo: string;
  espera_hora: string;
  iva_incluido: boolean;
  tarifas_revisadas: boolean;
  sena_pct: number;
  datos_transferencia: string | null;
  activo: boolean;
  unidades: UnidadAdmin[];
}

// --- Paquetes -----------------------------------------------------------------

export interface SalidaPaquete {
  id: string;
  nombre: string;
  fecha: string | null;
  precio_persona: string;
  disponibles: number;
}

export interface PaqueteResumen {
  slug: string;
  titulo: string;
  resumen: string;
  foto_url: string | null;
  dias: number | null;
  noches: number | null;
  precio_desde: string;
}

export interface Paquete extends PaqueteResumen {
  descripcion: string | null;
  incluye: string[];
  salidas: SalidaPaquete[];
  sena_pct: number;
  whatsapp_url: string;
}

export interface ReservaCreada {
  codigo: string;
  total: string;
  sena: string;
  sena_pct: number;
  datos_transferencia: string | null;
  whatsapp_url: string;
}

export interface SalidaAdmin extends SalidaPaquete {
  cupos: number;
  reservados: number;
  activo: boolean;
}

export interface PaqueteAdmin extends PaqueteResumen {
  descripcion: string | null;
  incluye: string[];
  orden: number;
  activo: boolean;
  salidas: SalidaAdmin[];
}

export type EstadoReserva =
  | "pendiente_sena"
  | "senada"
  | "confirmada"
  | "cancelada";

export interface ReservaAdmin {
  id: string;
  codigo: string;
  estado: EstadoReserva;
  paquete_titulo: string;
  salida_nombre: string;
  pasajeros: number;
  precio_persona: string;
  total: string;
  sena: string;
  nombre: string;
  email: string;
  telefono: string;
  dni: string | null;
  notas: string | null;
  created_at: string;
}

export interface ConsultaAdmin {
  id: string;
  paquete_titulo: string | null;
  nombre: string;
  telefono: string;
  email: string | null;
  mensaje: string | null;
  estado: "nueva" | "respondida";
  created_at: string;
}
