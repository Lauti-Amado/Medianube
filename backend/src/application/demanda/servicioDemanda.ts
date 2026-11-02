// Caso de uso: predicción de demanda de los próximos días por producto.
// Lo dispara EventBridge todas las madrugadas (05:30 ART, después del refresco de clima).
// No conoce AWS: depende solo de puertos.

import { fechaLocal, sumarDias } from "../../domain/clima/reglas";
import { ErrorValidacion } from "../../domain/errores";
import { VERSION_MODELO, backtest, precision, predecirProducto, serieDiaria } from "../../domain/demanda/modelo";
import type { ClimaDia, ConfigModelo, VentaDiaria } from "../../domain/demanda/tipos";
import type { ClimaLecturaPort, DemandaRepositorioPort, PrediccionGuardada } from "../../ports/demanda";
import type { LoggerPort } from "../../ports/logger";

const SEG_POR_DIA = 86_400;

export interface ConfigDemanda {
  zonaHoraria: string;
  diasPrediccion: number;
  ttlDias: number;
  modelo: ConfigModelo;
}

export interface ResultadoDemanda {
  usuarioID: string;
  versionModelo: string;
  generadaEn: string;
  desde: string;
  hasta: string;
  productos: number;
  predicciones: number;
  /** Precisión global (backtest de todos los productos), entre 0 y 1. */
  precisionPct: number | null;
  sinClima: boolean;
}

export interface ResumenCorrida {
  total: number;
  procesados: number;
  sinVentas: number;
  predicciones: number;
  fallidos: Array<{ usuarioID: string; error: string }>;
}

export interface DependenciasServicioDemanda {
  repositorio: DemandaRepositorioPort;
  clima: ClimaLecturaPort;
  config: ConfigDemanda;
  ahora?: () => Date;
  log?: LoggerPort;
}

export interface ServicioDemanda {
  predecirUsuario(usuarioID: string): Promise<ResultadoDemanda>;
  predecirTodos(): Promise<ResumenCorrida>;
}

const mensajeDe = (error: unknown): string => (error instanceof Error ? error.message : String(error));

function agruparPorProducto(ventas: VentaDiaria[]): Map<string, VentaDiaria[]> {
  const grupos = new Map<string, VentaDiaria[]>();
  for (const v of ventas) {
    const grupo = grupos.get(v.productoID);
    if (grupo) grupo.push(v);
    else grupos.set(v.productoID, [v]);
  }
  return grupos;
}

export function crearServicioDemanda({
  repositorio,
  clima,
  config,
  ahora = () => new Date(),
  log = console,
}: DependenciasServicioDemanda): ServicioDemanda {
  const { zonaHoraria, diasPrediccion, ttlDias, modelo } = config;

  async function leerClima(usuarioID: string, desde: string, hasta: string): Promise<Map<string, ClimaDia>> {
    try {
      const dias = await clima.consultarClima(usuarioID, desde, hasta);
      return new Map(dias.map((d) => [d.fecha, { fecha: d.fecha, probLluvia: d.probLluvia, precipitacionMm: d.precipitacionMm }]));
    } catch (error) {
      log.warn(JSON.stringify({ mensaje: "No se pudo leer el clima; se predice sin ajuste", usuarioID, error: mensajeDe(error) }));
      return new Map();
    }
  }

  async function predecirUsuario(usuarioID: string): Promise<ResultadoDemanda> {
    if (!usuarioID) throw new ErrorValidacion("Falta usuarioID.");

    const instante = ahora();
    const hoy = fechaLocal(instante, zonaHoraria);
    const ayer = sumarDias(hoy, -1); // a la madrugada, las ventas de hoy todavía no existen
    const hasta = sumarDias(hoy, diasPrediccion - 1);
    // Alcanza para N semanas de historial incluso para el día más viejo del backtest.
    const desdeHistorial = sumarDias(hoy, -(7 * modelo.semanas + modelo.diasBacktest));
    const fechasFuturas = Array.from({ length: diasPrediccion }, (_, i) => sumarDias(hoy, i));
    const generadaEn = instante.toISOString();

    const ventas = await repositorio.listarVentas(usuarioID, desdeHistorial, ayer);
    const base: ResultadoDemanda = {
      usuarioID,
      versionModelo: VERSION_MODELO,
      generadaEn,
      desde: hoy,
      hasta,
      productos: 0,
      predicciones: 0,
      precisionPct: null,
      sinClima: false,
    };
    if (ventas.length === 0) return base;

    const [productos, climaPorFecha] = await Promise.all([
      repositorio.listarProductos(usuarioID),
      leerClima(usuarioID, hoy, hasta),
    ]);
    const nombres = new Map(productos.map((p) => [p.productoID, p.nombre]));
    const expiraEn = Math.floor(instante.getTime() / 1000) + ttlDias * SEG_POR_DIA;

    const items: PrediccionGuardada[] = [];
    const total = { real: 0, error: 0 };
    let productosConPrediccion = 0;

    for (const [productoID, ventasProducto] of agruparPorProducto(ventas)) {
      const serie = serieDiaria(ventasProducto, desdeHistorial, ayer);
      const prueba = backtest(serie, ayer, modelo);
      total.real += prueba.real;
      total.error += prueba.error;
      const precisionProducto = precision(prueba);

      const predicciones = predecirProducto(productoID, serie, fechasFuturas, climaPorFecha, modelo);
      if (predicciones.length > 0) productosConPrediccion++;
      for (const p of predicciones) {
        items.push({
          usuarioID,
          fechaProducto: `${p.fecha}#${productoID}`,
          ...p,
          nombre: nombres.get(productoID) ?? productoID,
          precisionPct: precisionProducto,
          versionModelo: VERSION_MODELO,
          generadaEn,
          expiraEn,
        });
      }
    }

    if (items.length > 0) await repositorio.guardarPredicciones(items);

    return {
      ...base,
      productos: productosConPrediccion,
      predicciones: items.length,
      precisionPct: precision(total),
      sinClima: climaPorFecha.size === 0,
    };
  }

  /** Corrida nocturna: todos los usuarios, en serie (respeta la concurrencia reservada y la capacidad On-Demand). */
  async function predecirTodos(): Promise<ResumenCorrida> {
    const usuarios = await clima.listarUsuarios();
    const resumen: ResumenCorrida = { total: usuarios.length, procesados: 0, sinVentas: 0, predicciones: 0, fallidos: [] };

    for (const usuarioID of usuarios) {
      try {
        const resultado = await predecirUsuario(usuarioID);
        if (resultado.predicciones === 0) {
          resumen.sinVentas++;
        } else {
          resumen.procesados++;
          resumen.predicciones += resultado.predicciones;
        }
      } catch (error) {
        resumen.fallidos.push({ usuarioID, error: mensajeDe(error) });
        log.error(JSON.stringify({ mensaje: "Falló la predicción de un usuario", usuarioID, error: mensajeDe(error) }));
      }
    }
    return resumen;
  }

  return { predecirUsuario, predecirTodos };
}
