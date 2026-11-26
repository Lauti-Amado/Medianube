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

const conBarra = (ruta: string) => (ruta.startsWith("/") ? ruta : `/${ruta}`);

/** `apiUrl("/compras")` → `https://…amazonaws.com/compras` */
export function apiUrl(ruta: string): string {
  return `${API_BASE}${conBarra(ruta)}`;
}

/**
 * Edge caching (tarea 8): CloudFront delante de la API cachea solo `GET /clima` (30 min) y
 * `GET /demanda` (5 min), con `usuarioID` y `_` en la clave. Todo lo demás va directo a la API.
 * Se configura con `NEXT_PUBLIC_CDN_URL`. Si no está definida, se usa la distribución de la API de
 * desarrollo; y si la API es otra (`NEXT_PUBLIC_API_URL`), no se cachea: se usa esa misma API.
 */
const CDN_POR_DEFECTO = "https://d2nm15i6i0na2r.cloudfront.net";

export const CDN_BASE = (
  process.env.NEXT_PUBLIC_CDN_URL?.trim() || (API_BASE === API_POR_DEFECTO ? CDN_POR_DEFECTO : API_BASE)
).replace(/\/+$/, "");

/** Lecturas cacheables: `cdnUrl("/clima?usuarioID=…")` → `https://…cloudfront.net/clima?usuarioID=…` */
export function cdnUrl(ruta: string): string {
  return `${CDN_BASE}${conBarra(ruta)}`;
}

/** Pide la versión fresca salteando la caché: el parámetro `_` cambia la clave de caché de CloudFront. */
export function sinCache(url: string, ahora: number = Date.now()): string {
  return `${url}${url.includes("?") ? "&" : "?"}_=${ahora}`;
}
