// Adaptador de entrada de POST /precios/sugerir: traduce el evento de API Gateway HTTP API v2
// a una llamada al caso de uso, y los errores del dominio a códigos HTTP.

import type { ServicioPrecios } from "../../application/precios/servicioPrecios";
import { ErrorValidacion } from "../../domain/errores";
import type { LoggerPort } from "../../ports/logger";
import { type EventoHttp, resolverUsuarioID, respuesta } from "./http";

export interface DependenciasHandlerPrecios {
  servicio: ServicioPrecios;
  permitirUsuarioQuery?: boolean;
  log?: LoggerPort;
}

function leerCuerpo(event: EventoHttp): unknown {
  if (!event.body) throw new ErrorValidacion("Falta el cuerpo con el ticket.");
  const texto = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  try {
    return JSON.parse(texto);
  } catch {
    throw new ErrorValidacion("El cuerpo no es JSON válido.");
  }
}

export function crearHandlerPrecios({ servicio, permitirUsuarioQuery = false, log = console }: DependenciasHandlerPrecios) {
  return async function handler(event: EventoHttp) {
    const usuarioID = resolverUsuarioID(event, { permitirUsuarioQuery });
    if (!usuarioID) return respuesta(401, { error: "No autenticado." });

    try {
      const cuerpo = leerCuerpo(event) as { ticket?: unknown } | null;
      // Las fallas del LLM no llegan acá: el caso de uso responde con reglas (origen "reglas").
      return respuesta(200, await servicio.sugerirPrecios(usuarioID, cuerpo?.ticket));
    } catch (error) {
      if (error instanceof ErrorValidacion) {
        return respuesta(400, { error: error.message });
      }
      const e = error instanceof Error ? error : new Error(String(error));
      log.error(JSON.stringify({ mensaje: "Error inesperado en sugerirPrecios", usuarioID, error: e.message, stack: e.stack }));
      return respuesta(500, { error: "Error interno del servidor." });
    }
  };
}
