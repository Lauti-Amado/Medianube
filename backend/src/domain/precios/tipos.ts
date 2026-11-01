// Tipos del dominio de precios. No importa nada de AWS ni del proveedor de LLM.

export type Confianza = "alta" | "media" | "baja";

/** Unidad a la que se normalizan todos los precios para poder compararlos. */
export type UnidadBase = "kg" | "l" | "u";

/** Un ítem del ticket/factura tal como lo extrajo el OCR (y lo revisó la persona). */
export interface ItemTicket {
  descripcion: string;
  cantidad: number;
  /** Precio por bulto/presentación (ej. la bolsa de 25 kg), no por kg. */
  precioUnitario: number;
  /** Unidad explícita si el OCR la detectó; si no, se infiere de la descripción ("x 25 kg"). */
  unidad?: string | null;
}

export interface Ticket {
  proveedor?: string | null;
  fecha?: string | null;
  items: ItemTicket[];
}

/** Una línea de una factura histórica ya guardada. */
export interface CompraHistorica {
  insumo: string;
  fecha: string; // YYYY-MM-DD
  precioUnitario: number;
  unidad?: string | null;
  proveedor?: string | null;
}

/** Cantidad de un insumo que lleva una unidad de venta del producto (ej. 0.05 kg de harina por medialuna). */
export interface IngredienteReceta {
  insumo: string;
  cantidad: number;
  unidad: string;
}

export interface Producto {
  productoID: string;
  nombre: string;
  categoria?: string | null;
  precioActual: number;
  receta?: IngredienteReceta[];
  margenObjetivo?: number | null;
}

export interface PrecioBase {
  precio: number;
  unidad: UnidadBase;
}

/** Resumen del historial de un insumo: lo que se le manda al LLM en lugar de cada fila. */
export interface ResumenInsumo {
  insumo: string;
  ultimo: PrecioBase & { fecha: string };
  promedio: number;
  compras: number;
}

export interface Emparejamiento {
  /** Posición del ítem en el ticket. */
  indiceItem: number;
  /** Insumo de las recetas al que corresponde, o null si no corresponde a ninguno. */
  insumo: string | null;
  certeza: Confianza;
}

export interface VariacionInsumo {
  insumo: string;
  descripcionTicket: string;
  unidad: UnidadBase;
  precioAnterior: number | null;
  precioNuevo: number;
  /** Contra la última compra. null si no hay historial. */
  variacionPct: number | null;
  /** Contra el promedio de la ventana de historial. */
  variacionVsPromedioPct: number | null;
  certeza: Confianza;
}

export type EstadoPrecio = "estable" | "ajustar";

export interface SugerenciaPrecio {
  productoID: string;
  nombre: string;
  categoria: string | null;
  costoAnterior: number | null;
  costoNuevo: number | null;
  precioActual: number;
  precioSugerido: number;
  variacionPct: number;
  margenResultante: number | null;
  estado: EstadoPrecio;
  confianza: Confianza;
  justificacion: string;
  insumosAfectados: string[];
  /** true si las guardas (margen mínimo, tope de suba) corrigieron la propuesta. */
  ajustadoPorReglas: boolean;
  origen: "llm" | "reglas";
}
