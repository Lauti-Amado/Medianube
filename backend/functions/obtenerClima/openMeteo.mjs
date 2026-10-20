// Cliente de Open-Meteo (https://open-meteo.com): API de clima gratuita y sin API key,
// por lo que no hace falta gestionar secretos en Lambda.

import { describirCodigoClima } from "./weatherCodes.mjs";

const URL_BASE = "https://api.open-meteo.com/v1/forecast";

const VARIABLES_DIARIAS = [
  "temperature_2m_max",
  "temperature_2m_min",
  "precipitation_sum",
  "precipitation_probability_max",
  "weather_code",
].join(",");

/** Arma la URL de pronóstico diario para una ubicación. */
export function construirUrl({ lat, lon }, { dias = 7, zonaHoraria = "America/Argentina/Buenos_Aires" } = {}) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: VARIABLES_DIARIAS,
    timezone: zonaHoraria,
    forecast_days: String(dias),
  });
  return `${URL_BASE}?${params}`;
}

/**
 * Convierte la respuesta columnar de Open-Meteo (un array por variable)
 * en una lista de días con nombres de atributos propios del dominio.
 */
export function normalizarPronostico(respuesta) {
  const diario = respuesta?.daily;
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

/** Consulta el pronóstico y lo devuelve normalizado. Lanza error ante timeout o HTTP no-2xx. */
export async function obtenerPronostico(
  ubicacion,
  { fetchFn = fetch, timeoutMs = 5000, dias, zonaHoraria } = {}
) {
  const respuesta = await fetchFn(construirUrl(ubicacion, { dias, zonaHoraria }), {
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!respuesta.ok) {
    throw new Error(`Open-Meteo respondió HTTP ${respuesta.status}.`);
  }
  return normalizarPronostico(await respuesta.json());
}
