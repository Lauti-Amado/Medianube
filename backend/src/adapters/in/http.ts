// Piezas compartidas por los adaptadores HTTP (API Gateway HTTP API v2): identidad y respuestas.

/** Subconjunto del evento HTTP que usamos (evita depender de @types/aws-lambda). */
export interface EventoHttp {
  body?: string | null;
  isBase64Encoded?: boolean;
  queryStringParameters?: Record<string, string | undefined> | null;
  requestContext?: {
    authorizer?: { jwt?: { claims?: Record<string, unknown> } };
  };
}

export interface RespuestaHttp {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export function respuesta(statusCode: number, cuerpo: unknown): RespuestaHttp {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(cuerpo),
  };
}

/**
 * Prioriza el `sub` del JWT validado por el authorizer de Cognito en API Gateway.
 * Solo en modo desarrollo (sin authorizer) se acepta `?usuarioID=` por query string.
 */
export function resolverUsuarioID(
  event: EventoHttp | null | undefined,
  { permitirUsuarioQuery }: { permitirUsuarioQuery: boolean }
): string | null {
  const sub = event?.requestContext?.authorizer?.jwt?.claims?.sub;
  if (typeof sub === "string" && sub) return sub;
  if (permitirUsuarioQuery) return event?.queryStringParameters?.usuarioID ?? null;
  return null;
}
