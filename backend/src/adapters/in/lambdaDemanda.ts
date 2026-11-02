// Adaptador de entrada de predecirDemanda. No tiene ruta HTTP:
//   - EventBridge (regla diaria 05:30 ART) → predice para todos los usuarios.
//   - Invocación directa con { "usuarioID": "..." } (consola / CLI) → predice para ese usuario.

import type { ServicioDemanda } from "../../application/demanda/servicioDemanda";
import { ErrorValidacion } from "../../domain/errores";
import type { LoggerPort } from "../../ports/logger";
import { type EventoProgramado, esEventoProgramado } from "./eventos";

export interface EventoDemanda extends EventoProgramado {
  usuarioID?: unknown;
}

export interface DependenciasHandlerDemanda {
  servicio: ServicioDemanda;
  log?: LoggerPort;
}

export function crearHandlerDemanda({ servicio, log = console }: DependenciasHandlerDemanda) {
  return async function handler(event: EventoDemanda | null | undefined) {
    if (esEventoProgramado(event)) {
      const inicio = Date.now();
      const resumen = await servicio.predecirTodos();
      log.info(JSON.stringify({ mensaje: "Predicción programada de demanda finalizada", duracionMs: Date.now() - inicio, ...resumen }));
      return resumen;
    }

    if (typeof event?.usuarioID === "string" && event.usuarioID.trim()) {
      const resultado = await servicio.predecirUsuario(event.usuarioID.trim());
      log.info(JSON.stringify({ mensaje: "Predicción manual de demanda", ...resultado }));
      return resultado;
    }

    // Lanzar hace que una invocación mal armada quede como error en CloudWatch en vez de pasar en silencio.
    throw new ErrorValidacion("Evento no soportado: se espera un evento de EventBridge o { usuarioID }.");
  };
}
