// Tipos y errores del dominio de clima. No importa nada de AWS ni de proveedores externos.

export interface Ubicacion {
  lat: number;
  lon: number;
  ciudad: string | null;
}

/** Un día de pronóstico tal como lo entrega el proveedor, ya normalizado al lenguaje del dominio. */
export interface DiaPronostico {
  fecha: string; // YYYY-MM-DD
  tempMax: number | null;
  tempMin: number | null;
  precipitacionMm: number | null;
  probLluvia: number | null;
  codigoClima: number | null;
  descripcion: string;
}

/** Un día de pronóstico persistido (incluye atributos internos de cache). */
export interface DiaClimaGuardado extends DiaPronostico {
  usuarioID: string;
  actualizadoEn: string; // ISO-8601
  expiraEn: number; // epoch en segundos (TTL de DynamoDB)
}

/** Vista que se devuelve al cliente: sin atributos internos (usuarioID, expiraEn). */
export type DiaClimaPublico = Omit<DiaClimaGuardado, "usuarioID" | "expiraEn">;

// Los errores viven en el módulo compartido; se reexportan para no romper los imports existentes.
export { ErrorServicioExterno, ErrorValidacion } from "../errores";
