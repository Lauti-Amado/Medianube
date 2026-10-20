// Lógica de negocio del clima: estrategia cache-first sobre DynamoDB, con fallback
// a datos vencidos si la API externa falla.
// No importa el AWS SDK: recibe sus dependencias por parámetro para poder testearse sin AWS.

export class ErrorValidacion extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = "ErrorValidacion";
  }
}

export class ErrorServicioExterno extends Error {
  constructor(mensaje, opciones) {
    super(mensaje, opciones);
    this.name = "ErrorServicioExterno";
  }
}

const MS_POR_HORA = 3_600_000;
const SEG_POR_DIA = 86_400;

/** Fecha calendario (YYYY-MM-DD) de un instante en la zona horaria indicada. */
export function fechaLocal(instante, zonaHoraria) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zonaHoraria,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instante);
}

/** Suma días a una fecha YYYY-MM-DD (aritmética en UTC para evitar saltos por DST). */
export function sumarDias(fechaISO, dias) {
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

/** Valida y normaliza la ubicación guardada en Configuración. Devuelve null si es inválida. */
export function parsearUbicacion(ubicacion) {
  if (ubicacion?.lat == null || ubicacion?.lon == null || ubicacion.lat === "" || ubicacion.lon === "") {
    return null;
  }
  const lat = Number(ubicacion.lat);
  const lon = Number(ubicacion.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return null;
  }
  return { lat, lon, ciudad: ubicacion.ciudad ?? null };
}

/** Quita los atributos internos (usuarioID, expiraEn) antes de devolver al cliente. */
function aVistaPublica({ fecha, tempMax, tempMin, precipitacionMm, probLluvia, codigoClima, descripcion, actualizadoEn }) {
  return { fecha, tempMax, tempMin, precipitacionMm, probLluvia, codigoClima, descripcion, actualizadoEn };
}

/**
 * @param {object} deps
 * @param {object} deps.repositorio        obtenerConfiguracion, consultarClima, guardarClima, listarUsuarios
 * @param {Function} deps.obtenerPronostico (ubicacion) => Promise<Dia[]>
 * @param {object} deps.config             cacheHoras, diasPronostico, ttlDias, zonaHoraria, ubicacionPorDefecto
 */
export function crearServicioClima({ repositorio, obtenerPronostico, config, ahora = () => new Date(), log = console }) {
  const { cacheHoras, diasPronostico, ttlDias, zonaHoraria, ubicacionPorDefecto = null } = config;

  async function resolverUbicacion(usuarioID) {
    const configuracion = await repositorio.obtenerConfiguracion(usuarioID);
    const propia = parsearUbicacion(configuracion?.ubicacion);
    if (propia) return { ubicacion: propia, porDefecto: false };
    if (ubicacionPorDefecto) return { ubicacion: ubicacionPorDefecto, porDefecto: true };
    throw new ErrorValidacion(`El usuario ${usuarioID} no tiene una ubicación configurada.`);
  }

  function cacheVigente(items, instante) {
    if (items.length < diasPronostico) return false;
    const limite = instante.getTime() - cacheHoras * MS_POR_HORA;
    return items.every((item) => Date.parse(item.actualizadoEn) >= limite);
  }

  async function obtenerClimaUsuario(usuarioID, { forzar = false } = {}) {
    if (!usuarioID) throw new ErrorValidacion("Falta usuarioID.");

    const instante = ahora();
    const { ubicacion, porDefecto } = await resolverUbicacion(usuarioID);
    const desde = fechaLocal(instante, zonaHoraria);
    const hasta = sumarDias(desde, diasPronostico - 1);
    const cache = await repositorio.consultarClima(usuarioID, desde, hasta);
    const base = { usuarioID, ubicacion, ubicacionPorDefecto: porDefecto };

    if (!forzar && cacheVigente(cache, instante)) {
      return { ...base, origen: "cache", desactualizado: false, dias: cache.map(aVistaPublica) };
    }

    let pronostico;
    try {
      pronostico = await obtenerPronostico(ubicacion);
    } catch (error) {
      if (cache.length > 0) {
        log.warn(JSON.stringify({ mensaje: "Open-Meteo falló; se devuelve cache vencida", usuarioID, error: error.message }));
        return { ...base, origen: "cache", desactualizado: true, dias: cache.map(aVistaPublica) };
      }
      throw new ErrorServicioExterno("No se pudo obtener el pronóstico del clima.", { cause: error });
    }

    const actualizadoEn = instante.toISOString();
    const expiraEn = Math.floor(instante.getTime() / 1000) + ttlDias * SEG_POR_DIA;
    const items = pronostico.map((dia) => ({ usuarioID, ...dia, actualizadoEn, expiraEn }));

    // Si falla la escritura igual devolvemos el dato fresco: la cache es una optimización, no un requisito.
    try {
      await repositorio.guardarClima(items);
    } catch (error) {
      log.error(JSON.stringify({ mensaje: "No se pudo guardar el clima en DynamoDB", usuarioID, error: error.message }));
    }

    return { ...base, origen: "open-meteo", desactualizado: false, dias: items.map(aVistaPublica) };
  }

  /** Refresco programado (EventBridge): fuerza la actualización para todos los usuarios. */
  async function refrescarTodos() {
    const usuarios = await repositorio.listarUsuarios();
    const resultado = { total: usuarios.length, actualizados: 0, omitidos: 0, fallidos: [] };

    // Secuencial a propósito: respeta la concurrencia reservada y el rate limit de Open-Meteo.
    for (const usuarioID of usuarios) {
      try {
        const clima = await obtenerClimaUsuario(usuarioID, { forzar: true });
        if (clima.desactualizado) {
          resultado.fallidos.push({ usuarioID, error: "Open-Meteo no disponible; se mantuvo la cache." });
        } else {
          resultado.actualizados++;
        }
      } catch (error) {
        if (error instanceof ErrorValidacion) {
          resultado.omitidos++;
        } else {
          resultado.fallidos.push({ usuarioID, error: error.message });
        }
      }
    }
    return resultado;
  }

  return { obtenerClimaUsuario, refrescarTodos };
}
