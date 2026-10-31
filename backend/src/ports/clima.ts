// Puertos (contratos) del feature de clima. La capa de aplicación depende de estas interfaces;
// los adaptadores en src/adapters/out las implementan.

import type { DiaClimaGuardado, DiaPronostico, Ubicacion } from "../domain/clima/tipos";

/** Subconjunto de la configuración del negocio que necesita el clima. */
export interface ConfiguracionClima {
  usuarioID: string;
  /** Valor crudo tal como está en la base: se valida en el dominio (parsearUbicacion). */
  ubicacion?: unknown;
}

export interface ClimaRepositorioPort {
  obtenerConfiguracion(usuarioID: string): Promise<ConfiguracionClima | null>;
  /** Días entre `desde` y `hasta` (inclusive), formato YYYY-MM-DD. */
  consultarClima(usuarioID: string, desde: string, hasta: string): Promise<DiaClimaGuardado[]>;
  guardarClima(items: DiaClimaGuardado[]): Promise<void>;
  listarUsuarios(): Promise<string[]>;
}

export interface PronosticoPort {
  obtenerPronostico(ubicacion: Ubicacion): Promise<DiaPronostico[]>;
}
