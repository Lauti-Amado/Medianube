// Puertos del feature de predicción de demanda.

import type { Confianza, VentaDiaria } from "../domain/demanda/tipos";
import type { ClimaRepositorioPort } from "./clima";

export interface ProductoCatalogo {
  productoID: string;
  nombre: string;
}

/** Ítem de Medianube-Predicciones (PK usuarioID, SK fechaProducto = <YYYY-MM-DD>#<productoID>). */
export interface PrediccionGuardada {
  usuarioID: string;
  fechaProducto: string;
  fecha: string;
  productoID: string;
  nombre: string;
  cantidad: number;
  base: number;
  factorClima: number | null;
  confianza: Confianza;
  observaciones: number;
  /** Precisión estimada del modelo para este producto (backtest), entre 0 y 1. */
  precisionPct: number | null;
  versionModelo: string;
  generadaEn: string; // ISO-8601
  expiraEn: number; // epoch en segundos (TTL)
}

export interface DemandaRepositorioPort {
  /** Ventas diarias entre `desde` y `hasta` (inclusive), formato YYYY-MM-DD. */
  listarVentas(usuarioID: string, desde: string, hasta: string): Promise<VentaDiaria[]>;
  listarProductos(usuarioID: string): Promise<ProductoCatalogo[]>;
  guardarPredicciones(items: PrediccionGuardada[]): Promise<void>;
}

/** Lo que la predicción usa del repositorio de clima (se reutiliza el adaptador existente). */
export type ClimaLecturaPort = Pick<ClimaRepositorioPort, "consultarClima" | "listarUsuarios">;
