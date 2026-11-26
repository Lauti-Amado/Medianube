// Adaptador de entrada de predecirDemanda.
//   - EventBridge (regla diaria 05:30 ART) → predice para todos los usuarios.
//   - Invocación directa con { "usuarioID": "..." } (consola / CLI) → predice para ese usuario.
//   - POST HTTP (API Gateway /demanda/predecir) → predice para el usuario del body o del JWT.

import type { ServicioDemanda } from "../../application/demanda/servicioDemanda";
import { ErrorValidacion } from "../../domain/errores";
import type { LoggerPort } from "../../ports/logger";
import { type EventoProgramado, esEventoProgramado } from "./eventos";
import { respuesta, respuestaError } from "./http";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export interface EventoDemanda extends EventoProgramado {
  usuarioID?: unknown;
  body?: string | null;
  isBase64Encoded?: boolean;
  queryStringParameters?: Record<string, string | undefined> | null;
  rawPath?: string;
  routeKey?: string;
  requestContext?: {
    http?: { method?: string };
    authorizer?: { jwt?: { claims?: Record<string, unknown> } };
  };
}

export interface DependenciasHandlerDemanda {
  servicio: ServicioDemanda;
  log?: LoggerPort;
}

function esHttp(event: EventoDemanda | null | undefined): boolean {
  return Boolean(event?.requestContext?.http?.method || event?.rawPath || event?.routeKey);
}

function usuarioDesdeEvento(event: EventoDemanda | null | undefined): string | null {
  if (typeof event?.usuarioID === "string" && event.usuarioID.trim()) return event.usuarioID.trim();

  const sub = event?.requestContext?.authorizer?.jwt?.claims?.sub;
  if (typeof sub === "string" && sub) return sub;

  const query = event?.queryStringParameters?.usuarioID;
  if (typeof query === "string" && query.trim()) return query.trim();

  if (typeof event?.body === "string" && event.body) {
    try {
      const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString() : event.body;
      const data = JSON.parse(raw || "{}") as { usuarioID?: unknown };
      if (typeof data.usuarioID === "string" && data.usuarioID.trim()) return data.usuarioID.trim();
    } catch {
      return null;
    }
  }
  return null;
}

export function crearHandlerDemanda({ servicio, log = console }: DependenciasHandlerDemanda) {
  return async function handler(event: EventoDemanda | null | undefined) {
    const http = esHttp(event);
    const metodo = event?.requestContext?.http?.method ?? "POST";

    if (http && metodo === "OPTIONS") return respuesta(200, { ok: true }, CORS);

    try {
      if (esEventoProgramado(event)) {
        const inicio = Date.now();
        const resumen = await servicio.predecirTodos();
        log.info(JSON.stringify({ mensaje: "Predicción programada de demanda finalizada", duracionMs: Date.now() - inicio, ...resumen }));
        return resumen;
      }

      const usuarioID = usuarioDesdeEvento(event);
      if (usuarioID) {
        const resultado = await servicio.predecirUsuario(usuarioID);
        log.info(JSON.stringify({ mensaje: "Predicción manual de demanda", ...resultado }));
        return http ? respuesta(200, resultado, CORS) : resultado;
      }

      if (http) return respuesta(401, { error: "No autenticado." }, CORS);
      throw new ErrorValidacion("Evento no soportado: se espera un evento de EventBridge o { usuarioID }.");
    } catch (error) {
      if (!http) throw error;
      if (error instanceof ErrorValidacion) return respuesta(400, { error: error.message }, CORS);
      return respuestaError(error, { usuarioID: usuarioDesdeEvento(event), operacion: "predecirDemanda", log });
    }
  };
}
