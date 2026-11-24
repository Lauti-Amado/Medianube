// Mensajes de error de la API para mostrarle al usuario (en un toast), en lugar de un console.error.

/** Respuesta HTTP no exitosa de la API. Guarda el status para elegir el mensaje. */
export class ErrorApi extends Error {
  constructor(readonly status: number, mensaje = `Error HTTP ${status}`) {
    super(mensaje);
    this.name = "ErrorApi";
  }
}

/** Lo lanzan las pantallas cuando no hay token de Cognito. */
export class SesionVencida extends Error {
  constructor() {
    super("Sesión vencida");
    this.name = "SesionVencida";
  }
}

export const MENSAJE_SESION_VENCIDA = "Tu sesión venció. Volvé a iniciar sesión.";

/**
 * Mensaje claro en español para un error de una llamada a la API.
 * `accion` completa la frase "No pudimos …": "cargar tus compras", "guardar los cambios".
 */
export function mensajeDeError(error: unknown, accion: string): string {
  if (error instanceof SesionVencida || (error instanceof ErrorApi && (error.status === 401 || error.status === 403))) {
    return MENSAJE_SESION_VENCIDA;
  }
  // fetch rechaza con TypeError cuando no llega al servidor (sin internet, CORS, DNS)
  if (error instanceof TypeError) {
    return `No pudimos ${accion}. Revisá tu conexión y probá de nuevo.`;
  }
  return `No pudimos ${accion}. Probá de nuevo en unos minutos.`;
}
