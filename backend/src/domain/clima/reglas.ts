// Reglas puras de fechas y ubicación (sin I/O).

import type { Ubicacion } from "./tipos";

/** Fecha calendario (YYYY-MM-DD) de un instante en la zona horaria indicada. */
export function fechaLocal(instante: Date, zonaHoraria: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zonaHoraria,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instante);
}

/** Suma días a una fecha YYYY-MM-DD (aritmética en UTC para evitar saltos por DST). */
export function sumarDias(fechaISO: string, dias: number): string {
  const [anio, mes, dia] = fechaISO.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(anio, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

/** Valida y normaliza la ubicación guardada en Configuración. Devuelve null si es inválida. */
export function parsearUbicacion(ubicacion: unknown): Ubicacion | null {
  const u = ubicacion as { lat?: unknown; lon?: unknown; ciudad?: unknown } | null | undefined;
  if (u?.lat == null || u?.lon == null || u.lat === "" || u.lon === "") {
    return null;
  }
  const lat = Number(u.lat);
  const lon = Number(u.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return null;
  }
  return { lat, lon, ciudad: typeof u.ciudad === "string" ? u.ciudad : null };
}
