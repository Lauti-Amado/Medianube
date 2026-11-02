// Adaptador de entrada: traduce eventos de AWS (API Gateway HTTP API v2 / EventBridge)
// a llamadas al caso de uso, y los errores del dominio a códigos HTTP.

import { ErrorServicioExterno, ErrorValidacion } from "../../domain/clima/tipos";
import type { ServicioClima } from "../../application/clima/servicioClima";
import type { LoggerPort } from "../../ports/logger";
import { type EventoProgramado, esEventoProgramado } from "./eventos";
import { type EventoHttp, resolverUsuarioID, respuesta } from "./http";

export { esEventoProgramado, resolverUsuarioID };
export type { RespuestaHttp } from "./http";

/** Subconjunto del evento de Lambda que usamos (evita depender de @types/aws-lambda). */
export interface EventoLambda extends EventoHttp, EventoProgramado {}

export interface DependenciasHandlerClima {
  servicio: ServicioClima;
  permitirUsuarioQuery?: boolean;
  log?: LoggerPort;
}

export function crearHandlerClima({ servicio, permitirUsuarioQuery = false, log = console }: DependenciasHandlerClima) {
  return async function handler(event: EventoLambda) {
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
        log.error(
          JSON.stringify({ mensaje: error.message, usuarioID, causa: error.cause instanceof Error ? error.cause.message : undefined })
        );
        return respuesta(502, { error: error.message });
      }
      const e = error instanceof Error ? error : new Error(String(error));
      log.error(JSON.stringify({ mensaje: "Error inesperado en obtenerClima", usuarioID, error: e.message, stack: e.stack }));
      return respuesta(500, { error: "Error interno del servidor." });
    }
  };
}
