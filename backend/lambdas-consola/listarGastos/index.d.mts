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
}

export function usuarioDelEvento(event: unknown): string | null;

export function codificarCursor(clave: ClaveGasto): string;

export function decodificarCursor(cursor: string, usuarioID: string): ClaveGasto;

export function mesesDeReferencia(ahora: Date, zonaHoraria?: string): { actual: string; anterior: string };

export function calcularResumen(gastos: Array<Record<string, unknown>>, ahora: Date): Resumen;

export function handler(event: unknown): Promise<RespuestaLambda>;
