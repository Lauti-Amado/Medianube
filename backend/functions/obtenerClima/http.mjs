// Adaptador entre los eventos de AWS (API Gateway HTTP API v2 / EventBridge) y el servicio de clima.

import { ErrorServicioExterno, ErrorValidacion } from "./clima.mjs";

function respuesta(statusCode, cuerpo) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(cuerpo),
  };
}

export function esEventoProgramado(event) {
  return event?.source === "aws.events" || event?.["detail-type"] === "Scheduled Event";
}

/**
 * Prioriza el `sub` del JWT validado por el authorizer de Cognito en API Gateway.
 * Solo en modo desarrollo (sin authorizer) se acepta `?usuarioID=` por query string.
 */
export function resolverUsuarioID(event, { permitirUsuarioQuery }) {
  const sub = event?.requestContext?.authorizer?.jwt?.claims?.sub;
  if (sub) return sub;
  if (permitirUsuarioQuery) return event?.queryStringParameters?.usuarioID ?? null;
  return null;
}

export function crearHandler({ servicio, permitirUsuarioQuery = false, log = console }) {
  return async function handler(event) {
    if (esEventoProgramado(event)) {
      const resultado = await servicio.refrescarTodos();
      log.info(JSON.stringify({ mensaje: "Refresco programado de clima finalizado", ...resultado }));
      return resultado;
    }

    const usuarioID = resolverUsuarioID(event, { permitirUsuarioQuery });
    if (!usuarioID) return respuesta(401, { error: "No autenticado." });

    try {
      return respuesta(200, await servicio.obtenerClimaUsuario(usuarioID));
    } catch (error) {
      if (error instanceof ErrorValidacion) {
        return respuesta(400, { error: error.message });
      }
      if (error instanceof ErrorServicioExterno) {
        log.error(JSON.stringify({ mensaje: error.message, usuarioID, causa: error.cause?.message }));
        return respuesta(502, { error: error.message });
      }
      log.error(JSON.stringify({ mensaje: "Error inesperado en obtenerClima", usuarioID, error: error.message, stack: error.stack }));
      return respuesta(500, { error: "Error interno del servidor." });
    }
  };
}
