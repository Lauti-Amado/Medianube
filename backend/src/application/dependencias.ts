// Registro uniforme de caídas de dependencias externas. El texto "dependencia_caida" es el que
// cuentan los filtros de métricas de CloudWatch (ver infra/template.yaml).

import { type MotivoFalla, type ServicioExterno, motivoDe } from "../domain/errores";
import type { LoggerPort } from "../ports/logger";

export function registrarCaida(
  log: LoggerPort,
  { servicio, error, usuarioID, motivo = motivoDe(error), consecuencia }: {
    servicio: ServicioExterno;
    error: unknown;
    usuarioID?: string;
    motivo?: MotivoFalla;
    /** Qué hizo la aplicación para seguir respondiendo (ej. "se usan reglas"). */
    consecuencia: string;
  }
): void {
  log.warn(
    JSON.stringify({
      evento: "dependencia_caida",
      servicio,
      motivo,
      usuarioID,
      consecuencia,
      error: error instanceof Error ? error.message : String(error),
    })
  );
}
