// Adaptador de entrada: traduce eventos de AWS (API Gateway HTTP API v2 / EventBridge)
// a llamadas al caso de uso, y los errores del dominio a códigos HTTP.
// Open-Meteo caído no es un error HTTP: el caso de uso responde 200 con cache o degradado.

import { ErrorValidacion } from "../../domain/clima/tipos";
import type { ServicioClima } from "../../application/clima/servicioClima";
import type { LoggerPort } from "../../ports/logger";
import { type ContextoLambda, type EventoHttp, plazoDe, resolverUsuarioID, respuesta, respuestaError } from "./http";

export { resolverUsuarioID };
export type { RespuestaHttp } from "./http";

/** Subconjunto del evento de Lambda que usamos (evita depender de @types/aws-lambda). */
export interface EventoLambda extends EventoHttp {
  source?: string;
  "detail-type"?: string;
}

export function esEventoProgramado(event: EventoLambda | null | undefined): boolean {
  return event?.source === "aws.events" || event?.["detail-type"] === "Scheduled Event";
}

export interface DependenciasHandlerClima {
  servicio: ServicioClima;
  permitirUsuarioQuery?: boolean;
  log?: LoggerPort;
}

export function crearHandlerClima({ servicio, permitirUsuarioQuery = false, log = console }: DependenciasHandlerClima) {
  return async function handler(event: EventoLambda, contexto?: ContextoLambda) {
    if (esEventoProgramado(event)) {
      const resultado = await servicio.refrescarTodos({ plazo: plazoDe(contexto) });
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
      return respuestaError(error, { requestId: contexto?.awsRequestId, usuarioID, operacion: "obtenerClima", log });
    }
  };
}
