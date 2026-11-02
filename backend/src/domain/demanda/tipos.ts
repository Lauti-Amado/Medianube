// Tipos del dominio de predicción de demanda. No importa nada de AWS.

import type { Confianza } from "../precios/tipos";

export type { Confianza };

/** Unidades vendidas de un producto en un día (fila de Medianube-Ventas ya normalizada). */
export interface VentaDiaria {
  fecha: string; // YYYY-MM-DD
  productoID: string;
  cantidad: number;
}

/** Lo que el modelo necesita del pronóstico de un día. */
export interface ClimaDia {
  fecha: string; // YYYY-MM-DD
  probLluvia: number | null;
  precipitacionMm: number | null;
}

/** Serie diaria de un producto: fecha → unidades (los días sin venta dentro del rango valen 0). */
export type SerieDiaria = Map<string, number>;

export interface ConfigModelo {
  /** Semanas hacia atrás que se miran para el mismo día de la semana. */
  semanas: number;
  /** Peso relativo de cada semana respecto de la siguiente más reciente (0 < d ≤ 1). */
  decaimiento: number;
  /** Multiplicador cuando el pronóstico trae lluvia. */
  factorLluvia: number;
  umbralProbLluvia: number; // %
  umbralMm: number;
  /** Días reales recientes usados para estimar la precisión (backtest). */
  diasBacktest: number;
}

export const CONFIG_MODELO_DEFECTO: ConfigModelo = {
  semanas: 8,
  decaimiento: 0.8,
  factorLluvia: 0.85,
  umbralProbLluvia: 60,
  umbralMm: 2,
  diasBacktest: 7,
};

export interface EstimacionBase {
  base: number;
  observaciones: number;
  /** Coeficiente de variación de las observaciones (dispersión relativa). */
  cv: number;
}

export interface PrediccionProductoDia {
  fecha: string;
  productoID: string;
  /** Unidades a producir (entero, redondeado hacia arriba para no quedar cortos). */
  cantidad: number;
  base: number;
  /** null si no hay pronóstico para ese día. */
  factorClima: number | null;
  confianza: Confianza;
  observaciones: number;
}

export interface ResultadoBacktest {
  real: number;
  error: number;
  dias: number;
}
