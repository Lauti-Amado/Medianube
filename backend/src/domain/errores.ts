// Errores del dominio compartidos por todos los casos de uso.
// Una dependencia externa caída (ErrorServicioExterno) no llega al cliente como error HTTP:
// los casos de uso responden con el mejor dato disponible (cache, reglas) y el motivo explícito.

export class ErrorValidacion extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorValidacion";
  }
}

export type ServicioExterno = "open-meteo" | "claude";

/** Por qué falló una dependencia externa. Se loguea y se informa al cliente en respuestas degradadas. */
export type MotivoFalla =
  | "timeout"
  | "no_disponible" // error de red o 5xx
  | "limite" // 429 / 529: rate limit o sobrecarga
  | "respuesta_invalida"
  | "rechazo" // el LLM rechazó la solicitud
  | "sin_configuracion"; // falta la API key o es inválida

export class ErrorServicioExterno extends Error {
  readonly motivo: MotivoFalla;
  readonly servicio: ServicioExterno | null;

  constructor(
    mensaje: string,
    opciones: { cause?: unknown; motivo?: MotivoFalla; servicio?: ServicioExterno } = {}
  ) {
    super(mensaje, { cause: opciones.cause });
    this.name = "ErrorServicioExterno";
    this.motivo = opciones.motivo ?? "no_disponible";
    this.servicio = opciones.servicio ?? null;
  }
}

/** Motivo de un error cualquiera: si no es de un servicio externo, se asume no disponible. */
export function motivoDe(error: unknown): MotivoFalla {
  return error instanceof ErrorServicioExterno ? error.motivo : "no_disponible";
}
