// Tipos mínimos del index.mjs, para que los tests compilen con `strict`. No se despliegan.

export interface RespuestaLambda {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export function elegirUltimaSugerencia(items: Array<Record<string, unknown>>): Record<string, unknown> | null;

export function handler(event: unknown): Promise<RespuestaLambda>;
