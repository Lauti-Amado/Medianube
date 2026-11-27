// Lectura de la predicción que devuelve GET /demanda, compartida por Demanda y el Dashboard.
// Que las dos pantallas usen estas mismas funciones es lo que garantiza que muestren los mismos números.

import { apiUrl, cdnUrl } from "./api";

// Usuario de prueba fijo hasta unificar la identidad con Cognito (ver PENDIENTES-INTEGRACION, P1-1)
// Lectura cacheada en CloudFront (5 min); para la versión fresca, usar `sinCache(DEMANDA_URL)`.
export const DEMANDA_URL = cdnUrl("/demanda?usuarioID=user_test_123");
export const VENTAS_URL = apiUrl("/ventas");
export const PREDECIR_DEMANDA_URL = apiUrl("/demanda/predecir");

/** Mismo usuario que GET /demanda, hasta unificar Cognito. */
export const USUARIO_DEMANDA = "user_test_123";

/** Catálogo de respaldo (mismos IDs que el seed de Medianube-Ventas) si todavía no hay predicción. */
export const CATALOGO_VENTAS: { productoID: string; nombre: string }[] = [
  { productoID: "medialuna-manteca", nombre: "Medialuna de manteca" },
  { productoID: "medialuna-jyq", nombre: "Medialuna de jamón y queso" },
  { productoID: "pan-frances", nombre: "Pan francés" },
  { productoID: "alfajor-maicena", nombre: "Alfajor de maicena" },
  { productoID: "torta-ricota", nombre: "Torta de ricota" },
  { productoID: "cafe-con-leche", nombre: "Café con leche" },
  { productoID: "te-con-leche", nombre: "Té con leche" },
];

export interface VentaNueva {
  fecha: string;
  productoID: string;
  cantidad: number;
  origen?: string;
}

/** POST /demanda/predecir: corre predecirDemanda para el usuario de prueba y actualiza Medianube-Predicciones. */
export async function recalcularDemanda(): Promise<void> {
  const response = await fetch(PREDECIR_DEMANDA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuarioID: USUARIO_DEMANDA }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(typeof body?.error === "string" ? body.error : "No se pudo actualizar la predicción.");
  }
}

/** POST /ventas: guarda una fila en Medianube-Ventas. */
export async function guardarVenta(venta: VentaNueva): Promise<void> {
  const response = await fetch(VENTAS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      usuarioID: USUARIO_DEMANDA,
      fecha: venta.fecha,
      productoID: venta.productoID,
      cantidad: venta.cantidad,
      origen: venta.origen ?? "manual",
    }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(typeof body?.error === "string" ? body.error : "No se pudo guardar la venta.");
  }
}

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
