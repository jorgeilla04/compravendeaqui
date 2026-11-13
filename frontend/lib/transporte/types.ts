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
  activo: boolean;
  unidades: UnidadAdmin[];
}
