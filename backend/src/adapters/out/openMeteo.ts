// Adaptador de salida: implementa PronosticoPort contra Open-Meteo (https://open-meteo.com),
// API de clima gratuita y sin API key, por lo que no hace falta gestionar secretos en Lambda.

import { describirCodigoClima } from "../../domain/clima/codigosClima";
import type { DiaPronostico, Ubicacion } from "../../domain/clima/tipos";
import { ErrorServicioExterno, type MotivoFalla } from "../../domain/errores";
import type { PronosticoPort } from "../../ports/clima";

const URL_BASE = "https://api.open-meteo.com/v1/forecast";
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const invalida = (detalle: string) =>
  new ErrorServicioExterno(`Respuesta de Open-Meteo inválida: ${detalle}.`, {
    motivo: "respuesta_invalida",
    servicio: "open-meteo",
  });

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
    throw invalida("falta el bloque 'daily'");
  }
  // Un 200 sin días o con fechas rotas no sirve como pronóstico: se trata como falla del proveedor
  // para que el caso de uso use la cache (o responda degradado) en lugar de guardar un pronóstico vacío.
  if (diario.time.length === 0 || !diario.time.every((f) => typeof f === "string" && FECHA.test(f))) {
    throw invalida("sin días o con fechas inválidas");
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
  /** Timeout de cada intento. */
  timeoutMs?: number;
  /** Reintentos ante errores transitorios (red, timeout, 429, 5xx). */
  reintentos?: number;
  esperaReintentoMs?: number;
}

const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Convierte cualquier falla de la llamada en ErrorServicioExterno con su motivo. */
function clasificar(error: unknown): ErrorServicioExterno {
  if (error instanceof ErrorServicioExterno) return error;
  const nombre = error instanceof Error ? error.name : "";
  const motivo: MotivoFalla = nombre === "TimeoutError" || nombre === "AbortError" ? "timeout" : "no_disponible";
  const detalle = error instanceof Error ? error.message : String(error);
  return new ErrorServicioExterno(`Open-Meteo no respondió (${motivo}: ${detalle}).`, {
    cause: error,
    motivo,
    servicio: "open-meteo",
  });
}

function errorHttp(status: number): ErrorServicioExterno {
  const motivo: MotivoFalla = status === 429 ? "limite" : status >= 500 ? "no_disponible" : "respuesta_invalida";
  return new ErrorServicioExterno(`Open-Meteo respondió HTTP ${status}.`, { motivo, servicio: "open-meteo" });
}

/** Un 4xx (salvo 429) o una respuesta mal formada no mejoran reintentando. */
const esTransitorio = (e: ErrorServicioExterno) => e.motivo !== "respuesta_invalida";

/**
 * Consulta el pronóstico y lo devuelve normalizado. Reintenta los errores transitorios y lanza
 * ErrorServicioExterno (con motivo) si no consigue un pronóstico válido.
 * Peor caso: (reintentos + 1) × timeoutMs + esperas (con los defaults, ≈ 8,3 s).
 */
export function crearPronosticoOpenMeteo({
  fetchFn = fetch,
  timeoutMs = 4000,
  reintentos = 1,
  esperaReintentoMs = 300,
  dias,
  zonaHoraria,
}: OpcionesOpenMeteo = {}): PronosticoPort {
  async function intentar(ubicacion: Ubicacion): Promise<DiaPronostico[]> {
    try {
      // La señal también corta la lectura del cuerpo, no solo la conexión.
      const respuesta = await fetchFn(construirUrl(ubicacion, { dias, zonaHoraria }), {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!respuesta.ok) throw errorHttp(respuesta.status);
      let cuerpo: unknown;
      try {
        cuerpo = await respuesta.json();
      } catch (error) {
        if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) throw error;
        throw invalida("el cuerpo no es JSON");
      }
      return normalizarPronostico(cuerpo);
    } catch (error) {
      throw clasificar(error);
    }
  }

  return {
    async obtenerPronostico(ubicacion) {
      for (let intento = 0; ; intento++) {
        try {
          return await intentar(ubicacion);
        } catch (error) {
          const e = error as ErrorServicioExterno;
          if (intento >= reintentos || !esTransitorio(e)) throw e;
          await esperar(esperaReintentoMs);
        }
      }
    },
  };
}
