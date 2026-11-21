// Lectura de las facturas que devuelve GET /compras, compartida por Compras y el Dashboard.
// Que las dos pantallas usen estas mismas funciones es lo que garantiza que muestren los mismos números.

import { apiUrl } from "./api";

export type InvoiceStatus = "procesada" | "revisar" | "procesando";

export interface InvoiceItem {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
}

export interface Invoice {
  id: string;
  provider: string;
  /** Fecha AAAA-MM-DD tal como viene de la API, o "" si no vino. */
  date: string;
  items: number;
  itemsDetail: string;
  itemList: InvoiceItem[];
  total: number;
  status: InvoiceStatus;
  alert?: string;
}

// Forma de cada gasto que devuelve el endpoint /compras (campos opcionales por mapeo defensivo)
export interface GastoApi {
  gastoID?: string;
  proveedor?: string;
  fecha?: string;
  monto?: number | string;
  categoria?: string;
  usuarioID?: string;
  descripcion?: string;
  cantidadItems?: number;
  items?: { descripcion?: string; cantidad?: number | string; precio_unitario?: number | string; precioUnitario?: number | string }[];
  estado?: string;
  alerta?: string;
}

/** Totales del historial completo (sin filtros de búsqueda), para los KPIs. */
export interface Resumen {
  totalMes: number;
  facturasMes: number;
  /** Variación contra el mes anterior, en %. `null` si no hay con qué comparar. */
  variacion: number | null;
  porRevisar: number;
}

export const COMPRAS_URL = apiUrl("/compras");

/** Header de GET /compras. API Gateway exige el ID token de Cognito; sin él responde 401. */
export async function headersCompras(): Promise<Record<string, string>> {
  const { obtenerTokenAuth } = await import("./token");
  const token = await obtenerTokenAuth();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function toNumber(v: number | string | undefined) {
  const n = Number(v);
  return v != null && v !== "" && Number.isFinite(n) ? n : null;
}

export function mapInvoices(gastos: GastoApi[]): Invoice[] {
  return gastos.map((item, index) => {
    const itemList: InvoiceItem[] = Array.isArray(item.items)
      ? item.items.map((i) => ({
          description: i.descripcion || "ítem sin descripción",
          quantity: toNumber(i.cantidad),
          unitPrice: toNumber(i.precio_unitario ?? i.precioUnitario),
        }))
      : [];

    return {
      id: item.gastoID || `temp-id-${index}`,
      provider: item.proveedor || "Proveedor desconocido",
      date: item.fecha || "",
      items: itemList.length || item.cantidadItems || 1,
      itemsDetail: itemList.length
        ? itemList.map((i) => i.description).join(", ")
        : item.categoria || item.descripcion || "insumos varios",
      itemList,
      total: Number(item.monto) || 0,
      status: (item.estado || "procesada") as InvoiceStatus,
      alert: item.alerta || undefined,
    };
  });
}

export function calcularResumen(invoices: Invoice[], hoy: Date): Resumen {
  const clave = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const mesActual = clave(hoy);
  const mesAnterior = clave(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1));
  const delMes = invoices.filter((i) => i.date.startsWith(mesActual));
  const totalMes = delMes.reduce((acc, i) => acc + i.total, 0);
  const totalAnterior = invoices.filter((i) => i.date.startsWith(mesAnterior)).reduce((acc, i) => acc + i.total, 0);
  return {
    totalMes,
    facturasMes: delMes.length,
    variacion: totalAnterior > 0 ? (totalMes / totalAnterior - 1) * 100 : null,
    porRevisar: invoices.filter((i) => i.status === "revisar").length,
  };
}

/** La API devuelve `{ gastos: [...] }` o directamente el array; cualquier otra cosa es una lista vacía. */
export function leerGastos(data: unknown): GastoApi[] {
  if (Array.isArray(data)) return data as GastoApi[];
  const gastos = (data as { gastos?: unknown } | null)?.gastos;
  return Array.isArray(gastos) ? (gastos as GastoApi[]) : [];
}

export interface PaginaGastos {
  gastos: GastoApi[];
  /** Cursor de la próxima página, o `null` si es la última. */
  siguiente: string | null;
  /** KPIs de todo el historial, calculados por el backend. Solo viene en la primera página. */
  resumen: Resumen | null;
}

const esNumero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Lee la respuesta de GET /compras?limite=N. Un `resumen` incompleto se descarta en lugar de mostrar NaN. */
export function leerPagina(data: unknown): PaginaGastos {
  const d = (data ?? {}) as { siguiente?: unknown; resumen?: Partial<Record<keyof Resumen, unknown>> | null };
  const r = d.resumen;
  const resumen =
    r && esNumero(r.totalMes) && esNumero(r.facturasMes) && esNumero(r.porRevisar) && (r.variacion === null || esNumero(r.variacion))
      ? { totalMes: r.totalMes, facturasMes: r.facturasMes, porRevisar: r.porRevisar, variacion: r.variacion }
      : null;
  return {
    gastos: leerGastos(data),
    siguiente: typeof d.siguiente === "string" && d.siguiente ? d.siguiente : null,
    resumen,
  };
}

/** Las `n` facturas más recientes; las que no tienen fecha van al final. No modifica la lista recibida. */
export function recientes(invoices: Invoice[], n: number): Invoice[] {
  return [...invoices].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, n);
}
