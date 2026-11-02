// Piezas compartidas por los adaptadores HTTP (API Gateway HTTP API v2): identidad, respuestas y errores.

import type { LoggerPort } from "../../ports/logger";

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

/** Subconjunto del contexto de Lambda que usamos (evita depender de @types/aws-lambda). */
export interface ContextoLambda {
  awsRequestId?: string;
  getRemainingTimeInMillis?: () => number;
}

export function respuesta(statusCode: number, cuerpo: unknown, headers: Record<string, string> = {}): RespuestaHttp {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
    body: JSON.stringify(cuerpo),
  };
}

/** Tiempo restante de la invocación (ms), para que los casos de uso acoten sus llamadas externas. */
export function plazoDe(contexto: ContextoLambda | null | undefined): (() => number) | undefined {
  const restante = contexto?.getRemainingTimeInMillis;
  return typeof restante === "function" ? () => restante.call(contexto) : undefined;
}

const ERRORES_THROTTLING = new Set([
  "ThrottlingException",
  "ProvisionedThroughputExceededException",
  "RequestLimitExceeded",
  "TooManyRequestsException",
]);

/** true si el error es un throttling de AWS (DynamoDB): conviene reintentar en unos segundos. */
export function esThrottling(error: unknown): boolean {
  return error instanceof Error && ERRORES_THROTTLING.has(error.name);
}

/**
 * Respuesta para un error propio (no de validación): 503 con Retry-After si es throttling de AWS,
 * 500 en cualquier otro caso. Siempre JSON y con el requestId para buscarlo en CloudWatch.
 */
export function respuestaError(
  error: unknown,
  { requestId, usuarioID, operacion, log }: { requestId?: string; usuarioID?: string | null; operacion: string; log: LoggerPort }
): RespuestaHttp {
  const e = error instanceof Error ? error : new Error(String(error));
  const id = requestId ?? null;
  if (esThrottling(e)) {
    log.warn(JSON.stringify({ mensaje: `Throttling en ${operacion}`, usuarioID, requestId: id, error: e.name }));
    return respuesta(
      503,
      { error: "El servicio está saturado. Probá de nuevo en unos segundos.", requestId: id },
      { "Retry-After": "2" }
    );
  }
  log.error(
    JSON.stringify({ mensaje: `Error inesperado en ${operacion}`, usuarioID, requestId: id, error: e.message, stack: e.stack })
  );
  return respuesta(500, { error: "Error interno del servidor.", requestId: id });
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
