// Puertos (contratos) del motor de precios. La capa de aplicación depende de estas interfaces;
// los adaptadores en src/adapters/out las implementan (DynamoDB, API de Claude).

import type {
  CompraHistorica,
  Confianza,
  Emparejamiento,
  IngredienteReceta,
  PrecioBase,
  Producto,
  SugerenciaPrecio,
  UnidadBase,
} from "../domain/precios/tipos";

/** Subconjunto de la configuración del negocio que necesita el motor de precios. */
export interface ConfiguracionPrecios {
  margenObjetivo?: number | null;
  tipoNegocio?: string | null;
}

export interface SugerenciaGuardada extends SugerenciaPrecio {
  generadaEn: string; // ISO-8601
  versionPrompt: string;
}

export interface PreciosRepositorioPort {
  /** Líneas de las facturas con fecha >= `desde` (YYYY-MM-DD). */
  listarCompras(usuarioID: string, desde: string): Promise<CompraHistorica[]>;
  listarProductos(usuarioID: string): Promise<Producto[]>;
  obtenerConfiguracion(usuarioID: string): Promise<ConfiguracionPrecios | null>;
  guardarSugerencias(usuarioID: string, sugerencias: SugerenciaGuardada[]): Promise<void>;
}

/** Todo lo que el LLM necesita para decidir, con los números ya calculados por el dominio. */
export interface ContextoPrecios {
  negocio: {
    tipo: string | null;
    margenObjetivo: number;
    margenMinimo: number;
    topeSubaPct: number;
  };
  ticket: {
    proveedor: string | null;
    fecha: string | null;
    items: Array<{
      indice: number;
      descripcion: string;
      cantidad: number;
      precioUnitario: number;
      precioBase: PrecioBase;
      /** Emparejamiento sugerido por similitud de nombres (el LLM puede corregirlo). */
      candidato: string | null;
      variacionCandidatoPct: number | null;
    }>;
  };
  insumos: Array<{
    insumo: string;
    ultimoPrecio: number | null;
    unidad: UnidadBase | null;
    promedio: number | null;
    compras: number;
  }>;
  productos: Array<{
    productoID: string;
    nombre: string;
    categoria: string | null;
    precioActual: number;
    receta: IngredienteReceta[];
    costoActual: number | null;
    /** Costo si se aceptan los emparejamientos candidatos. */
    costoNuevoEstimado: number | null;
    margenObjetivo: number;
  }>;
}

export interface PropuestaPrecioLLM {
  productoID: string;
  precioSugerido: number;
  confianza: Confianza;
  justificacion: string;
}

export interface PropuestaLLM {
  emparejamientos: Emparejamiento[];
  sugerencias: PropuestaPrecioLLM[];
}

export interface SugeridorPreciosPort {
  /** Versión del prompt, para poder auditar qué instrucciones generaron cada sugerencia. */
  readonly versionPrompt: string;
  /** `timeoutMs`: corte para esta llamada (el caso de uso lo acota al tiempo que le queda a la Lambda). */
  sugerir(contexto: ContextoPrecios, opciones?: { timeoutMs?: number }): Promise<PropuestaLLM>;
}
