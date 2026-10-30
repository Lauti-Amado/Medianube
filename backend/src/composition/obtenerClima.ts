// Composition root de la Lambda `obtenerClima`: único lugar donde se leen variables de entorno
// y se conectan adaptadores con casos de uso.
// Disparadores: API Gateway (GET /clima) y EventBridge (refresco diario 05:00 ART).

import { crearHandlerClima } from "../adapters/in/lambdaClima";
import { crearClimaRepositorioDynamo } from "../adapters/out/climaRepositorioDynamo";
import { crearPronosticoOpenMeteo } from "../adapters/out/openMeteo";
import { crearServicioClima } from "../application/clima/servicioClima";
import type { Ubicacion } from "../domain/clima/tipos";

const env = process.env;

function requerida(nombre: string): string {
  const valor = env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}.`);
  return valor;
}

function leerUbicacionPorDefecto(): Ubicacion | null {
  const lat = Number(env.UBICACION_DEFECTO_LAT);
  const lon = Number(env.UBICACION_DEFECTO_LON);
  if (!env.UBICACION_DEFECTO_LAT || !env.UBICACION_DEFECTO_LON || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  return { lat, lon, ciudad: env.UBICACION_DEFECTO_CIUDAD || null };
}

const zonaHoraria = env.ZONA_HORARIA || "America/Argentina/Buenos_Aires";
const diasPronostico = Number(env.DIAS_PRONOSTICO || 7);
const timeoutMs = Number(env.TIMEOUT_API_MS || 5000);

// Se inicializa fuera del handler para reutilizar el cliente de DynamoDB entre invocaciones (warm start).
const servicio = crearServicioClima({
  repositorio: crearClimaRepositorioDynamo({
    tablaClima: requerida("TABLA_CLIMA"),
    tablaConfiguracion: requerida("TABLA_CONFIGURACION"),
  }),
  pronostico: crearPronosticoOpenMeteo({ dias: diasPronostico, zonaHoraria, timeoutMs }),
  config: {
    cacheHoras: Number(env.CACHE_HORAS || 6),
    diasPronostico,
    ttlDias: Number(env.TTL_DIAS || 14),
    zonaHoraria,
    ubicacionPorDefecto: leerUbicacionPorDefecto(),
  },
});

export const handler = crearHandlerClima({
  servicio,
  permitirUsuarioQuery: env.PERMITIR_USUARIO_QUERY === "true",
});
