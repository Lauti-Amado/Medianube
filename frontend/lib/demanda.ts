// Lectura de la predicción que devuelve GET /demanda, compartida por Demanda y el Dashboard.
// Que las dos pantallas usen estas mismas funciones es lo que garantiza que muestren los mismos números.

import { apiUrl } from "./api";

// Usuario de prueba fijo hasta unificar la identidad con Cognito (ver PENDIENTES-INTEGRACION, P1-1)
export const DEMANDA_URL = apiUrl("/demanda?usuarioID=user_test_123");

export interface ProductoApi {
  productoID: string;
  nombre: string;
  unidadProducto?: string;
  cantidad: number;
  confianza?: string;
  fecha?: string;
}

export interface DemandaApiResponse {
  origen?: string;
  produccion?: ProductoApi[];
  precision?: number | null;
}

export interface DiaDemanda {
  fecha: string;
  /** Suma de la producción de todos los productos del día. */
  total: number;
  /** Productos del día, de mayor a menor cantidad. */
  items: ProductoApi[];
}

export interface ResumenSemana {
  total: number;
  promedio: number;
  pico: DiaDemanda | null;
  /** Cuánto supera el pico al promedio, en %. 0 si no hay con qué comparar. */
  picoPct: number;
}

/** Agrupa la predicción por fecha (ignora lo que no tiene fecha), con los días en orden. */
export function agruparPorDia(productos: ProductoApi[]): DiaDemanda[] {
  const porFecha = new Map<string, ProductoApi[]>();
  for (const p of productos) {
    if (!p.fecha) continue;
    porFecha.set(p.fecha, [...(porFecha.get(p.fecha) ?? []), p]);
  }
  return [...porFecha.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, items]) => ({
      fecha,
      total: items.reduce((acc, p) => acc + p.cantidad, 0),
      items: [...items].sort((a, b) => b.cantidad - a.cantidad),
    }));
}

export function resumenSemana(dias: DiaDemanda[]): ResumenSemana {
  const total = dias.reduce((acc, d) => acc + d.total, 0);
  const promedio = dias.length > 0 ? total / dias.length : 0;
  const pico = dias.reduce<DiaDemanda | null>((max, d) => (!max || d.total > max.total ? d : max), null);
  const picoPct = pico && promedio > 0 ? Math.round((pico.total / promedio - 1) * 100) : 0;
  return { total, promedio, pico, picoPct };
}

export function isoLocal(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}
