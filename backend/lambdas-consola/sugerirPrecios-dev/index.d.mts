// Tipos mínimos del index.mjs, para que los tests compilen con `strict`. No se despliegan.

export interface RespuestaLambda {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export interface ProductoCalculable {
  productoID: string;
  precioActual: number;
  costoActual: number;
  [campo: string]: unknown;
}

export function elegirUltimaSugerencia(items: Array<Record<string, unknown>>): Record<string, unknown> | null;

export function preciosPorReglas(products: ProductoCalculable[]): {
  sugerencias: Array<{ productoID: string; precioSugerido: number; razonamiento: string; confianza: string }>;
};

export function handler(event: unknown): Promise<RespuestaLambda>;
