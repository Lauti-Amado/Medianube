// Tipos mínimos del index.mjs, para que los tests compilen con `strict`. No se despliegan.

export interface RespuestaLambda {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export interface ClaveGasto {
  gastoID: string;
  usuarioID: string;
  fecha: string;
}

export interface Resumen {
  totalMes: number;
  facturasMes: number;
  variacion: number | null;
  porRevisar: number;
  sobreprecios: Sobreprecios;
}

export interface Sobreprecios {
  /** Lo pagado de más este mes respecto del precio habitual de cada insumo, en pesos. */
  total: number;
  /** Insumos con suba, de mayor a menor (hasta 3). */
  insumos: Array<{ nombre: string; variacionPct: number }>;
}

export function usuarioDelEvento(event: unknown): string | null;

export function codificarCursor(clave: ClaveGasto): string;

export function decodificarCursor(cursor: string, usuarioID: string): ClaveGasto;

export function mesesDeReferencia(ahora: Date, zonaHoraria?: string): { actual: string; anterior: string };

export function calcularSobreprecios(gastos: Array<Record<string, unknown>>, mesActual: string, umbralPct?: number): Sobreprecios;

export function calcularResumen(gastos: Array<Record<string, unknown>>, ahora: Date): Resumen;

export function handler(event: unknown): Promise<RespuestaLambda>;
