// Modelo estadístico de demanda v1 (funciones puras, sin I/O).
//
// Para cada producto y día futuro:
//   base     = promedio ponderado de las ventas del mismo día de la semana en las últimas N semanas
//              (las semanas más recientes pesan más: decaimiento exponencial).
//   cantidad = ceil(base × factorClima), con factorClima < 1 si el pronóstico trae lluvia.
// La confianza sale de la cantidad de observaciones y de su dispersión; la precisión, de un
// backtest sobre los últimos días reales con el mismo modelo.

import { sumarDias } from "../clima/reglas";
import type {
  ClimaDia,
  Confianza,
  ConfigModelo,
  EstimacionBase,
  PrediccionProductoDia,
  ResultadoBacktest,
  SerieDiaria,
  VentaDiaria,
} from "./tipos";

export const VERSION_MODELO = "demanda-v1";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** 0 = domingo … 6 = sábado. Calculado en UTC para no depender de la zona horaria del runtime. */
export function diaSemana(fecha: string): number {
  return new Date(`${fecha}T00:00:00Z`).getUTCDay();
}

const redondear = (n: number, decimales = 2) => Math.round(n * 10 ** decimales) / 10 ** decimales;

/**
 * Arma la serie diaria de un producto entre `desde` y `hasta` (inclusive).
 * Los días sin venta valen 0, pero solo a partir de la primera venta registrada: antes de eso el
 * producto quizás no existía y contar ceros bajaría la predicción injustamente.
 */
export function serieDiaria(ventas: VentaDiaria[], desde: string, hasta: string): SerieDiaria {
  const porFecha = new Map<string, number>();
  for (const v of ventas) {
    if (!FECHA.test(v.fecha) || v.fecha < desde || v.fecha > hasta) continue;
    if (!Number.isFinite(v.cantidad) || v.cantidad < 0) continue;
    porFecha.set(v.fecha, (porFecha.get(v.fecha) ?? 0) + v.cantidad);
  }
  const serie: SerieDiaria = new Map();
  const primera = [...porFecha.keys()].sort()[0];
  if (!primera) return serie;
  for (let f = primera; f <= hasta; f = sumarDias(f, 1)) {
    serie.set(f, porFecha.get(f) ?? 0);
  }
  return serie;
}

/** Pesos de la más reciente a la más antigua: [1, d, d², …]. */
export function pesos(n: number, decaimiento: number): number[] {
  return Array.from({ length: n }, (_, i) => decaimiento ** i);
}

/** Estimación base para `fecha` mirando el mismo día de la semana en las semanas anteriores. */
export function baseMismoDia(
  serie: SerieDiaria,
  fecha: string,
  { semanas, decaimiento }: Pick<ConfigModelo, "semanas" | "decaimiento">
): EstimacionBase | null {
  const valores: number[] = [];
  for (let k = 1; k <= semanas; k++) {
    const valor = serie.get(sumarDias(fecha, -7 * k));
    if (valor !== undefined) valores.push(valor);
  }
  if (valores.length === 0) return null;

  const w = pesos(valores.length, decaimiento);
  const sumaPesos = w.reduce((a, b) => a + b, 0);
  const base = valores.reduce((acc, v, i) => acc + v * w[i]!, 0) / sumaPesos;

  const media = valores.reduce((a, b) => a + b, 0) / valores.length;
  const varianza = valores.reduce((acc, v) => acc + (v - media) ** 2, 0) / valores.length;
  const cv = media > 0 ? Math.sqrt(varianza) / media : 0; // todo en cero: sin dispersión

  return { base: redondear(base, 6), observaciones: valores.length, cv: redondear(cv, 4) };
}

/** Multiplicador por clima. null si no hay pronóstico para el día (el modelo usa 1). */
export function factorClima(
  clima: ClimaDia | undefined,
  { factorLluvia, umbralProbLluvia, umbralMm }: Pick<ConfigModelo, "factorLluvia" | "umbralProbLluvia" | "umbralMm">
): number | null {
  if (!clima || (clima.probLluvia == null && clima.precipitacionMm == null)) return null;
  const llueve = (clima.probLluvia ?? 0) >= umbralProbLluvia || (clima.precipitacionMm ?? 0) >= umbralMm;
  return llueve ? factorLluvia : 1;
}

const NIVELES: Confianza[] = ["baja", "media", "alta"];

/** Alta con ≥ 6 observaciones y poca dispersión; sin pronóstico del clima baja un nivel. */
export function confianzaPorEvidencia(observaciones: number, cv: number, conClima: boolean): Confianza {
  let nivel = observaciones >= 6 && cv < 0.25 ? 2 : observaciones >= 3 && cv < 0.5 ? 1 : 0;
  if (!conClima) nivel = Math.max(0, nivel - 1);
  return NIVELES[nivel]!;
}

/**
 * Backtest: predice cada uno de los últimos `diasBacktest` días reales (hasta `hasta`) con la
 * información anterior a ese día y acumula el error absoluto. No usa clima (no hay histórico).
 */
export function backtest(serie: SerieDiaria, hasta: string, config: ConfigModelo): ResultadoBacktest {
  const resultado: ResultadoBacktest = { real: 0, error: 0, dias: 0 };
  for (let i = config.diasBacktest - 1; i >= 0; i--) {
    const fecha = sumarDias(hasta, -i);
    const real = serie.get(fecha);
    if (real === undefined) continue;
    const estimacion = baseMismoDia(serie, fecha, config);
    if (!estimacion) continue;
    resultado.real += real;
    resultado.error += Math.abs(real - estimacion.base);
    resultado.dias++;
  }
  return resultado;
}

/** Precisión = 1 − wMAPE, acotada a [0, 1]. null si no hubo ventas para comparar. */
export function precision({ real, error }: Pick<ResultadoBacktest, "real" | "error">): number | null {
  if (real <= 0) return null;
  return redondear(Math.min(1, Math.max(0, 1 - error / real)), 3);
}

/** Predicción de un producto para cada fecha futura. Omite fechas sin ninguna observación. */
export function predecirProducto(
  productoID: string,
  serie: SerieDiaria,
  fechasFuturas: string[],
  climaPorFecha: Map<string, ClimaDia>,
  config: ConfigModelo
): PrediccionProductoDia[] {
  const predicciones: PrediccionProductoDia[] = [];
  for (const fecha of fechasFuturas) {
    const estimacion = baseMismoDia(serie, fecha, config);
    if (!estimacion) continue;
    const factor = factorClima(climaPorFecha.get(fecha), config);
    const esperado = estimacion.base * (factor ?? 1);
    predicciones.push({
      fecha,
      productoID,
      cantidad: esperado <= 0 ? 0 : Math.ceil(redondear(esperado, 6)),
      base: redondear(estimacion.base),
      factorClima: factor,
      confianza: confianzaPorEvidencia(estimacion.observaciones, estimacion.cv, factor !== null),
      observaciones: estimacion.observaciones,
    });
  }
  return predicciones;
}
