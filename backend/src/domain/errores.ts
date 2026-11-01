// Errores del dominio compartidos por todos los casos de uso.
// Los adaptadores de entrada los traducen a códigos HTTP (400 / 502).

export class ErrorValidacion extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorValidacion";
  }
}

export class ErrorServicioExterno extends Error {
  constructor(mensaje: string, opciones?: { cause?: unknown }) {
    super(mensaje, opciones);
    this.name = "ErrorServicioExterno";
  }
}
