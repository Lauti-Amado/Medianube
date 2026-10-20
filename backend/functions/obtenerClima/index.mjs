// Punto de entrada de la Lambda `obtenerClima`.
// Disparadores: API Gateway (GET /clima) y EventBridge (refresco diario 05:00 ART).

import { crearServicioClima } from "./clima.mjs";
import { crearHandler } from "./http.mjs";
import { obtenerPronostico } from "./openMeteo.mjs";
import { crearRepositorio } from "./repositorio.mjs";

const env = process.env;

function requerida(nombre) {
  if (!env[nombre]) throw new Error(`Falta la variable de entorno ${nombre}.`);
  return env[nombre];
}

function leerUbicacionPorDefecto() {
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
  repositorio: crearRepositorio({
    tablaClima: requerida("TABLA_CLIMA"),
    tablaConfiguracion: requerida("TABLA_CONFIGURACION"),
  }),
  obtenerPronostico: (ubicacion) => obtenerPronostico(ubicacion, { dias: diasPronostico, zonaHoraria, timeoutMs }),
  config: {
    cacheHoras: Number(env.CACHE_HORAS || 6),
    diasPronostico,
    ttlDias: Number(env.TTL_DIAS || 14),
    zonaHoraria,
    ubicacionPorDefecto: leerUbicacionPorDefecto(),
  },
});

export const handler = crearHandler({
  servicio,
  permitirUsuarioQuery: env.PERMITIR_USUARIO_QUERY === "true",
});
