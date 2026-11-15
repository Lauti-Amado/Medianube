/**
 * Base única de la API (HTTP API de API Gateway). Todas las pantallas arman sus URLs desde acá.
 *
 * Se configura con `NEXT_PUBLIC_API_URL`. Si no está definida, se usa la API de desarrollo.
 * Por compatibilidad con la configuración anterior de Precios, se acepta que la variable
 * termine en `/precios` o `/precios/sugerir`: se recorta hasta la raíz de la API.
 */
const API_POR_DEFECTO = "https://1i2vqeifsi.execute-api.us-east-2.amazonaws.com";

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL?.trim() || API_POR_DEFECTO)
  .replace(/\/+$/, "")
  .replace(/\/precios(\/sugerir)?$/, "");

/** `apiUrl("/compras")` → `https://…amazonaws.com/compras` */
export function apiUrl(ruta: string): string {
  return `${API_BASE}${ruta.startsWith("/") ? ruta : `/${ruta}`}`;
}
