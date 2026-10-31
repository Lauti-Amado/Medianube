// Casos de uso del clima: estrategia cache-first sobre un repositorio, con fallback
// a datos vencidos si el proveedor de pronóstico falla.
// No conoce AWS ni Open-Meteo: depende solo de puertos.

import { ErrorServicioExterno, ErrorValidacion } from "../../domain/clima/tipos";
import type { DiaClimaGuardado, DiaClimaPublico, Ubicacion } from "../../domain/clima/tipos";
import { fechaLocal, parsearUbicacion, sumarDias } from "../../domain/clima/reglas";
import type { ClimaRepositorioPort, PronosticoPort } from "../../ports/clima";
import type { LoggerPort } from "../../ports/logger";

const MS_POR_HORA = 3_600_000;
const SEG_POR_DIA = 86_400;

export interface ConfigClima {
  cacheHoras: number;
  diasPronostico: number;
  ttlDias: number;
  zonaHoraria: string;
  ubicacionPorDefecto?: Ubicacion | null;
}

export interface ResultadoClima {
  usuarioID: string;
  ubicacion: Ubicacion;
  ubicacionPorDefecto: boolean;
  origen: "cache" | "open-meteo";
  desactualizado: boolean;
  dias: DiaClimaPublico[];
}

export interface ResumenRefresco {
  total: number;
  actualizados: number;
  omitidos: number;
  fallidos: Array<{ usuarioID: string; error: string }>;
}

export interface DependenciasServicioClima {
  repositorio: ClimaRepositorioPort;
  pronostico: PronosticoPort;
  config: ConfigClima;
  ahora?: () => Date;
  log?: LoggerPort;
}

export interface ServicioClima {
  obtenerClimaUsuario(usuarioID: string, opciones?: { forzar?: boolean }): Promise<ResultadoClima>;
  refrescarTodos(): Promise<ResumenRefresco>;
}

/** Quita los atributos internos (usuarioID, expiraEn) antes de devolver al cliente. */
function aVistaPublica(d: DiaClimaGuardado): DiaClimaPublico {
  return {
    fecha: d.fecha,
    tempMax: d.tempMax,
    tempMin: d.tempMin,
    precipitacionMm: d.precipitacionMm,
    probLluvia: d.probLluvia,
    codigoClima: d.codigoClima,
    descripcion: d.descripcion,
    actualizadoEn: d.actualizadoEn,
  };
}

const mensajeDe = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export function crearServicioClima({
  repositorio,
  pronostico,
  config,
  ahora = () => new Date(),
  log = console,
}: DependenciasServicioClima): ServicioClima {
  const { cacheHoras, diasPronostico, ttlDias, zonaHoraria, ubicacionPorDefecto = null } = config;

  async function resolverUbicacion(usuarioID: string): Promise<{ ubicacion: Ubicacion; porDefecto: boolean }> {
    const configuracion = await repositorio.obtenerConfiguracion(usuarioID);
    const propia = parsearUbicacion(configuracion?.ubicacion);
    if (propia) return { ubicacion: propia, porDefecto: false };
    if (ubicacionPorDefecto) return { ubicacion: ubicacionPorDefecto, porDefecto: true };
    throw new ErrorValidacion(`El usuario ${usuarioID} no tiene una ubicación configurada.`);
  }

  function cacheVigente(items: DiaClimaGuardado[], instante: Date): boolean {
    if (items.length < diasPronostico) return false;
    const limite = instante.getTime() - cacheHoras * MS_POR_HORA;
    return items.every((item) => Date.parse(item.actualizadoEn) >= limite);
  }

  async function obtenerClimaUsuario(usuarioID: string, { forzar = false } = {}): Promise<ResultadoClima> {
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

    let dias;
    try {
      dias = await pronostico.obtenerPronostico(ubicacion);
    } catch (error) {
      if (cache.length > 0) {
        log.warn(JSON.stringify({ mensaje: "Open-Meteo falló; se devuelve cache vencida", usuarioID, error: mensajeDe(error) }));
        return { ...base, origen: "cache", desactualizado: true, dias: cache.map(aVistaPublica) };
      }
      throw new ErrorServicioExterno("No se pudo obtener el pronóstico del clima.", { cause: error });
    }

    const actualizadoEn = instante.toISOString();
    const expiraEn = Math.floor(instante.getTime() / 1000) + ttlDias * SEG_POR_DIA;
    const items: DiaClimaGuardado[] = dias.map((dia) => ({ usuarioID, ...dia, actualizadoEn, expiraEn }));

    // Si falla la escritura igual devolvemos el dato fresco: la cache es una optimización, no un requisito.
    try {
      await repositorio.guardarClima(items);
    } catch (error) {
      log.error(JSON.stringify({ mensaje: "No se pudo guardar el clima en DynamoDB", usuarioID, error: mensajeDe(error) }));
    }

    return { ...base, origen: "open-meteo", desactualizado: false, dias: items.map(aVistaPublica) };
  }

  /** Refresco programado (EventBridge): fuerza la actualización para todos los usuarios. */
  async function refrescarTodos(): Promise<ResumenRefresco> {
    const usuarios = await repositorio.listarUsuarios();
    const resultado: ResumenRefresco = { total: usuarios.length, actualizados: 0, omitidos: 0, fallidos: [] };

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
          resultado.fallidos.push({ usuarioID, error: mensajeDe(error) });
        }
      }
    }
    return resultado;
  }

  return { obtenerClimaUsuario, refrescarTodos };
}
