// Tipos mínimos del index.mjs, para que los tests compilen con `strict`. No se despliegan.

export interface RespuestaLambda {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export function usuarioDelEvento(event: unknown): string | null;

export function leerCambios(body: unknown): Record<string, unknown>;

export function armarActualizacion(
  usuarioID: string,
  cambios: Record<string, unknown>,
  ahora: string
): {
  TableName: string;
  Key: { usuarioID: string };
  UpdateExpression: string;
  ExpressionAttributeNames: Record<string, string>;
  ExpressionAttributeValues: Record<string, unknown>;
  ReturnValues: string;
};

export function handler(event: unknown): Promise<RespuestaLambda>;
