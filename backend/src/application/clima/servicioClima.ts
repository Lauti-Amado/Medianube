// Casos de uso del clima: estrategia cache-first sobre un repositorio. Si el proveedor de
// pronóstico falla, se devuelve la cache vencida y, si no hay, una respuesta degradada
// (disponible: false): una caída de Open-Meteo nunca es un error para el cliente.
// No conoce AWS ni Open-Meteo: depende solo de puertos.

import { ErrorValidacion } from "../../domain/clima/tipos";
import type { DiaClimaGuardado, DiaClimaPublico, Ubicacion } from "../../domain/clima/tipos";
import { fechaLocal, parsearUbicacion, sumarDias } from "../../domain/clima/reglas";
import type { ClimaRepositorioPort, PronosticoPort } from "../../ports/clima";
import type { LoggerPort } from "../../ports/logger";
import { registrarCaida } from "../dependencias";

const MS_POR_HORA = 3_600_000;
const SEG_POR_DIA = 86_400;

export interface ConfigClima {
  cacheHoras: number;
  diasPronostico: number;
  ttlDias: number;
  zonaHoraria: string;
  ubicacionPorDefecto?: Ubicacion | null;
  /** Refresco programado: deja de llamar al proveedor tras esta cantidad de caídas seguidas. */
  caidasParaCortar?: number;
  /** Refresco programado: no empieza otro usuario si quedan menos de estos ms de invocación. */
  margenPlazoMs?: number;
}

export const AVISO_SIN_DATOS = "El pronóstico del clima no está disponible en este momento.";
export const AVISO_DESACTUALIZADO = "No se pudo actualizar el pronóstico: se muestra el último guardado.";

export interface ResultadoClima {
  usuarioID: string;
  ubicacion: Ubicacion;
  ubicacionPorDefecto: boolean;
  /** "sin-datos": el proveedor no respondió y no había cache (dias vacío). */
  origen: "cache" | "open-meteo" | "sin-datos";
  /** false si no hay ningún pronóstico para mostrar. */
  disponible: boolean;
  desactualizado: boolean;
  /** Mensaje para el usuario cuando la respuesta está degradada. */
  aviso: string | null;
  dias: DiaClimaPublico[];
}

export interface ResumenRefresco {
  total: number;
  actualizados: number;
  omitidos: number;
  /** No se intentaron porque el proveedor ya había fallado varias veces seguidas (circuit breaker). */
  omitidosPorProveedor: number;
  /** No se llegaron a procesar porque se acababa el tiempo de la invocación. */
  pendientes: number;
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
  /** `plazo`: ms que le quedan a la invocación (Lambda getRemainingTimeInMillis). */
  refrescarTodos(opciones?: { plazo?: () => number }): Promise<ResumenRefresco>;
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
  const {
    cacheHoras,
    diasPronostico,
    ttlDias,
    zonaHoraria,
    ubicacionPorDefecto = null,
    caidasParaCortar = 2,
    margenPlazoMs = 10_000,
  } = config;

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
      return { ...base, origen: "cache", disponible: true, desactualizado: false, aviso: null, dias: cache.map(aVistaPublica) };
    }

    let dias;
    try {
      dias = await pronostico.obtenerPronostico(ubicacion);
    } catch (error) {
      const hayCache = cache.length > 0;
      registrarCaida(log, {
        servicio: "open-meteo",
        error,
        usuarioID,
        consecuencia: hayCache ? "se devuelve la cache vencida" : "se responde sin pronóstico",
      });
      return hayCache
        ? { ...base, origen: "cache", disponible: true, desactualizado: true, aviso: AVISO_DESACTUALIZADO, dias: cache.map(aVistaPublica) }
        : { ...base, origen: "sin-datos", disponible: false, desactualizado: true, aviso: AVISO_SIN_DATOS, dias: [] };
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

    return { ...base, origen: "open-meteo", disponible: true, desactualizado: false, aviso: null, dias: items.map(aVistaPublica) };
  }

  /**
   * Refresco programado (EventBridge): fuerza la actualización para todos los usuarios.
   * Nunca deja la invocación cortada por timeout: corta antes si el proveedor está caído
   * (circuit breaker) o si se acaba el tiempo, y siempre devuelve el resumen.
   */
  async function refrescarTodos({ plazo }: { plazo?: () => number } = {}): Promise<ResumenRefresco> {
    const usuarios = await repositorio.listarUsuarios();
    const resultado: ResumenRefresco = {
      total: usuarios.length,
      actualizados: 0,
      omitidos: 0,
      omitidosPorProveedor: 0,
      pendientes: 0,
      fallidos: [],
    };
    let caidasSeguidas = 0;

    // Secuencial a propósito: respeta la concurrencia reservada y el rate limit de Open-Meteo.
    for (const [indice, usuarioID] of usuarios.entries()) {
      if (plazo && plazo() < margenPlazoMs) {
        resultado.pendientes = usuarios.length - indice;
        log.warn(JSON.stringify({ mensaje: "Refresco de clima cortado por falta de tiempo", pendientes: resultado.pendientes }));
        break;
      }
      if (caidasSeguidas >= caidasParaCortar) {
        // La cache de esos usuarios sigue sirviendo (desactualizada) hasta el próximo refresco.
        resultado.omitidosPorProveedor = usuarios.length - indice;
        log.warn(
          JSON.stringify({
            mensaje: "Open-Meteo no responde: se corta el refresco (circuit breaker)",
            omitidos: resultado.omitidosPorProveedor,
          })
        );
        break;
      }
      try {
        const clima = await obtenerClimaUsuario(usuarioID, { forzar: true });
        if (clima.origen === "open-meteo") {
          resultado.actualizados++;
          caidasSeguidas = 0;
        } else {
          caidasSeguidas++;
          resultado.fallidos.push({ usuarioID, error: "Open-Meteo no disponible; se mantuvo la cache." });
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
