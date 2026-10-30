// Adaptador de salida: implementa PronosticoPort contra Open-Meteo (https://open-meteo.com),
// API de clima gratuita y sin API key, por lo que no hace falta gestionar secretos en Lambda.

import { describirCodigoClima } from "../../domain/clima/codigosClima";
import type { DiaPronostico, Ubicacion } from "../../domain/clima/tipos";
import type { PronosticoPort } from "../../ports/clima";

const URL_BASE = "https://api.open-meteo.com/v1/forecast";

const VARIABLES_DIARIAS = [
  "temperature_2m_max",
  "temperature_2m_min",
  "precipitation_sum",
  "precipitation_probability_max",
  "weather_code",
].join(",");

interface OpcionesUrl {
  dias?: number;
  zonaHoraria?: string;
}

/** Arma la URL de pronóstico diario para una ubicación. */
export function construirUrl(
  { lat, lon }: Pick<Ubicacion, "lat" | "lon">,
  { dias = 7, zonaHoraria = "America/Argentina/Buenos_Aires" }: OpcionesUrl = {}
): string {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: VARIABLES_DIARIAS,
    timezone: zonaHoraria,
    forecast_days: String(dias),
  });
  return `${URL_BASE}?${params}`;
}

interface RespuestaOpenMeteo {
  daily?: {
    time?: string[];
    temperature_2m_max?: Array<number | null>;
    temperature_2m_min?: Array<number | null>;
    precipitation_sum?: Array<number | null>;
    precipitation_probability_max?: Array<number | null>;
    weather_code?: Array<number | null>;
  };
}

/**
 * Convierte la respuesta columnar de Open-Meteo (un array por variable)
 * en una lista de días con nombres de atributos propios del dominio.
 */
export function normalizarPronostico(respuesta: unknown): DiaPronostico[] {
  const diario = (respuesta as RespuestaOpenMeteo | null | undefined)?.daily;
  if (!diario || !Array.isArray(diario.time)) {
    throw new Error("Respuesta de Open-Meteo inválida: falta el bloque 'daily'.");
  }

  return diario.time.map((fecha, i) => {
    const codigoClima = diario.weather_code?.[i] ?? null;
    return {
      fecha,
      tempMax: diario.temperature_2m_max?.[i] ?? null,
      tempMin: diario.temperature_2m_min?.[i] ?? null,
      precipitacionMm: diario.precipitation_sum?.[i] ?? null,
      probLluvia: diario.precipitation_probability_max?.[i] ?? null,
      codigoClima,
      descripcion: describirCodigoClima(codigoClima),
    };
  });
}

export interface OpcionesOpenMeteo extends OpcionesUrl {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

/** Consulta el pronóstico y lo devuelve normalizado. Lanza error ante timeout o HTTP no-2xx. */
export function crearPronosticoOpenMeteo({
  fetchFn = fetch,
  timeoutMs = 5000,
  dias,
  zonaHoraria,
}: OpcionesOpenMeteo = {}): PronosticoPort {
  return {
    async obtenerPronostico(ubicacion) {
      const respuesta = await fetchFn(construirUrl(ubicacion, { dias, zonaHoraria }), {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!respuesta.ok) {
        throw new Error(`Open-Meteo respondió HTTP ${respuesta.status}.`);
      }
      return normalizarPronostico(await respuesta.json());
    },
  };
}
