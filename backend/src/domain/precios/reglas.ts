// Reglas puras del motor de precios (sin I/O). Todos los números que ve el usuario salen de acá:
// el LLM propone y explica, pero estas funciones calculan costos y tienen la última palabra.

import { ErrorValidacion } from "../errores";
import type {
  CompraHistorica,
  Confianza,
  EstadoPrecio,
  IngredienteReceta,
  ItemTicket,
  PrecioBase,
  ResumenInsumo,
  Ticket,
  UnidadBase,
} from "./tipos";

// ── Unidades ────────────────────────────────────────────────────────────────

const FACTORES: Record<string, { base: UnidadBase; factor: number }> = {
  kg: { base: "kg", factor: 1 },
  kgs: { base: "kg", factor: 1 },
  kilo: { base: "kg", factor: 1 },
  kilos: { base: "kg", factor: 1 },
  g: { base: "kg", factor: 0.001 },
  gr: { base: "kg", factor: 0.001 },
  grs: { base: "kg", factor: 0.001 },
  l: { base: "l", factor: 1 },
  lt: { base: "l", factor: 1 },
  lts: { base: "l", factor: 1 },
  litro: { base: "l", factor: 1 },
  litros: { base: "l", factor: 1 },
  ml: { base: "l", factor: 0.001 },
  cc: { base: "l", factor: 0.001 },
  u: { base: "u", factor: 1 },
  un: { base: "u", factor: 1 },
  unidad: { base: "u", factor: 1 },
  unidades: { base: "u", factor: 1 },
  docena: { base: "u", factor: 12 },
};

const REGEX_PRESENTACION = /(\d+(?:[.,]\d+)?)\s*(kgs?|kilos?|grs?|g|lts?|litros?|l|ml|cc|unidades|unidad|un|u|docena)\b/gi;

function aNumero(texto: string): number {
  return Number(texto.replace(",", "."));
}

/** Convierte una cantidad en una unidad cualquiera a la unidad base. null si la unidad no se reconoce. */
export function cantidadEnUnidadBase(cantidad: number, unidad: string): { cantidad: number; unidad: UnidadBase } | null {
  const f = FACTORES[unidad.trim().toLowerCase()];
  if (!f || !Number.isFinite(cantidad)) return null;
  return { cantidad: cantidad * f.factor, unidad: f.base };
}

/**
 * Precio por kg / l / u de una presentación. Toma el tamaño de la descripción ("Harina 000 x 25 kg")
 * y, si no hay, la unidad explícita. Sin ninguna de las dos se asume precio por unidad.
 */
export function precioPorUnidadBase(item: Pick<ItemTicket, "descripcion" | "precioUnitario" | "unidad">): PrecioBase {
  const coincidencias = [...item.descripcion.matchAll(REGEX_PRESENTACION)];
  const ultima = coincidencias.at(-1);
  if (ultima) {
    const enBase = cantidadEnUnidadBase(aNumero(ultima[1]!), ultima[2]!);
    if (enBase && enBase.cantidad > 0) {
      return { precio: item.precioUnitario / enBase.cantidad, unidad: enBase.unidad };
    }
  }
  const explicita = item.unidad ? cantidadEnUnidadBase(1, item.unidad) : null;
  if (explicita) return { precio: item.precioUnitario / explicita.cantidad, unidad: explicita.unidad };
  return { precio: item.precioUnitario, unidad: "u" };
}

// ── Nombres de insumos ──────────────────────────────────────────────────────

const PALABRAS_VACIAS = new Set(["de", "del", "la", "el", "x", "por", "con", "en", "y", "para"]);

/** Minúsculas, sin acentos, sin presentaciones ni números: "Harina 000 x 25 kg" → "harina 000". */
export function normalizarNombre(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(REGEX_PRESENTACION, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !PALABRAS_VACIAS.has(t))
    .join(" ");
}

function tokens(texto: string): Set<string> {
  return new Set(normalizarNombre(texto).split(" ").filter(Boolean));
}

/**
 * Similitud entre dos nombres (0..1): proporción de los tokens del nombre más corto presentes en el otro.
 * Así "harina 000" coincide con "harina 000 canuelas bolsa papel" aunque el ticket agregue la marca.
 */
export function similitud(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  const [menor, mayor] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  let comunes = 0;
  for (const t of menor) if (mayor.has(t)) comunes++;
  return comunes / menor.size;
}

const UMBRAL_EMPAREJAMIENTO = 0.6;

/** Mejor insumo candidato para una descripción, por similitud de nombres. null si ninguno alcanza el umbral. */
export function emparejarPorNombre(descripcion: string, insumos: string[]): { insumo: string; certeza: Confianza } | null {
  let mejor: { insumo: string; puntaje: number } | null = null;
  for (const insumo of insumos) {
    const puntaje = similitud(descripcion, insumo);
    if (puntaje >= UMBRAL_EMPAREJAMIENTO && (!mejor || puntaje > mejor.puntaje)) mejor = { insumo, puntaje };
  }
  if (!mejor) return null;
  return { insumo: mejor.insumo, certeza: mejor.puntaje === 1 ? "alta" : "media" };
}

// ── Historial ───────────────────────────────────────────────────────────────

/** Agrupa las compras históricas por insumo de receta: último precio, promedio y cantidad de compras. */
export function resumirHistorial(compras: CompraHistorica[], insumos: string[]): Map<string, ResumenInsumo> {
  const porInsumo = new Map<string, Array<PrecioBase & { fecha: string }>>();
  for (const compra of compras) {
    const match = emparejarPorNombre(compra.insumo, insumos);
    if (!match) continue;
    const base = precioPorUnidadBase({ descripcion: compra.insumo, precioUnitario: compra.precioUnitario, unidad: compra.unidad ?? null });
    const lista = porInsumo.get(match.insumo) ?? [];
    lista.push({ ...base, fecha: compra.fecha });
    porInsumo.set(match.insumo, lista);
  }

  const resumen = new Map<string, ResumenInsumo>();
  for (const [insumo, lista] of porInsumo) {
    lista.sort((a, b) => a.fecha.localeCompare(b.fecha));
    const ultimo = lista.at(-1)!;
    // Solo se promedian precios en la misma unidad que la última compra.
    const comparables = lista.filter((p) => p.unidad === ultimo.unidad);
    const promedio = comparables.reduce((acc, p) => acc + p.precio, 0) / comparables.length;
    resumen.set(insumo, { insumo, ultimo, promedio, compras: lista.length });
  }
  return resumen;
}

/** Variación porcentual redondeada a un decimal. null si no hay precio anterior válido. */
export function variacionPct(nuevo: number, anterior: number | null | undefined): number | null {
  if (anterior == null || !(anterior > 0)) return null;
  return Math.round(((nuevo - anterior) / anterior) * 1000) / 10;
}

// ── Costos y precios ────────────────────────────────────────────────────────

/** Costo de una unidad de venta según la receta. Los insumos sin precio o con unidad incompatible quedan en `faltantes`. */
export function costoReceta(
  receta: IngredienteReceta[],
  costos: Map<string, PrecioBase>
): { costo: number; faltantes: string[] } {
  let costo = 0;
  const faltantes: string[] = [];
  for (const ingrediente of receta) {
    const precio = costos.get(ingrediente.insumo);
    const cantidad = cantidadEnUnidadBase(ingrediente.cantidad, ingrediente.unidad);
    if (!precio || !cantidad || cantidad.unidad !== precio.unidad) {
      faltantes.push(ingrediente.insumo);
      continue;
    }
    costo += cantidad.cantidad * precio.precio;
  }
  return { costo, faltantes };
}

/** Precio que deja el margen indicado sobre el precio de venta: costo / (1 − margen). */
export function precioPorMargen(costo: number, margen: number): number {
  if (!(margen >= 0 && margen < 1)) throw new RangeError(`Margen inválido: ${margen}`);
  return costo / (1 - margen);
}

export function margen(precio: number, costo: number): number {
  return Math.round(((precio - costo) / precio) * 1000) / 1000;
}

/** Redondeo comercial en ARS: múltiplos de $10 debajo de $1.000 y de $50 desde $1.000. */
export function redondearPrecio(precio: number, sentido: "arriba" | "abajo" = "arriba"): number {
  const paso = precio < 1000 ? 10 : 50;
  // El épsilon evita que errores de punto flotante (480.0000001) salten al múltiplo siguiente.
  const pasos = precio / paso;
  return (sentido === "arriba" ? Math.ceil(pasos - 1e-9) : Math.floor(pasos + 1e-9)) * paso;
}

export interface Guardas {
  costoNuevo: number;
  precioActual: number;
  margenMinimo: number;
  /** Suba máxima por ajuste, como fracción (0.25 = 25 %). */
  topeSubaPct: number;
}

/**
 * Acota la propuesta entre un piso (margen mínimo sobre el costo nuevo) y un techo (tope de suba sobre el
 * precio actual), y la redondea. Si el piso supera al techo gana el techo: la suba se hace en pasos
 * graduales y la confianza/justificación lo indican.
 */
export function aplicarGuardas(propuesto: number, guardas: Guardas): { precio: number; ajustado: boolean; motivo: string | null } {
  const piso = precioPorMargen(guardas.costoNuevo, guardas.margenMinimo);
  const techo = guardas.precioActual * (1 + guardas.topeSubaPct);

  let precio = Number.isFinite(propuesto) && propuesto > 0 ? propuesto : piso;
  let motivo: string | null = Number.isFinite(propuesto) && propuesto > 0 ? null : "propuesta_invalida";
  if (precio < piso) {
    precio = piso;
    motivo = "margen_minimo";
  }
  if (precio > techo) {
    precio = techo;
    motivo = piso > techo ? "tope_suba_bajo_margen_minimo" : "tope_suba";
  }

  let redondeado = redondearPrecio(precio);
  if (redondeado > techo) redondeado = redondearPrecio(techo, "abajo");
  return { precio: redondeado, ajustado: motivo !== null, motivo };
}

const UMBRAL_ESTABLE_PCT = 2;

export function estadoPorVariacion(pct: number): EstadoPrecio {
  return Math.abs(pct) < UMBRAL_ESTABLE_PCT ? "estable" : "ajustar";
}

const ORDEN: Record<Confianza, number> = { baja: 0, media: 1, alta: 2 };

export function confianzaMinima(...valores: Array<Confianza | null | undefined>): Confianza {
  const definidos = valores.filter((v): v is Confianza => v != null);
  if (definidos.length === 0) return "baja";
  return definidos.reduce((min, v) => (ORDEN[v] < ORDEN[min] ? v : min));
}

/**
 * Confianza de una sugerencia según la evidencia: baja con receta incompleta o menos de 3 compras
 * del insumo, media con menos de 6, alta en otro caso. Nunca supera la certeza del emparejamiento.
 */
export function confianzaPorEvidencia({
  recetaCompleta,
  comprasMinimas,
  certezaEmparejamiento,
}: {
  recetaCompleta: boolean;
  comprasMinimas: number;
  certezaEmparejamiento: Confianza;
}): Confianza {
  const porHistorial: Confianza = !recetaCompleta || comprasMinimas < 3 ? "baja" : comprasMinimas < 6 ? "media" : "alta";
  return confianzaMinima(porHistorial, certezaEmparejamiento);
}

// ── Validación de entrada ───────────────────────────────────────────────────

const MAX_ITEMS = 100;

/** Valida y normaliza el ticket que llega por la API. Lanza ErrorValidacion con un mensaje para el usuario. */
export function validarTicket(crudo: unknown): Ticket {
  const t = crudo as { proveedor?: unknown; fecha?: unknown; items?: unknown } | null | undefined;
  if (!t || !Array.isArray(t.items) || t.items.length === 0) {
    throw new ErrorValidacion("El ticket debe tener al menos un ítem.");
  }
  if (t.items.length > MAX_ITEMS) {
    throw new ErrorValidacion(`El ticket no puede tener más de ${MAX_ITEMS} ítems.`);
  }
  const items = t.items.map((crudoItem, i): ItemTicket => {
    const it = crudoItem as { descripcion?: unknown; cantidad?: unknown; precioUnitario?: unknown; unidad?: unknown } | null;
    const descripcion = typeof it?.descripcion === "string" ? it.descripcion.trim().slice(0, 200) : "";
    const cantidad = Number(it?.cantidad);
    const precioUnitario = Number(it?.precioUnitario);
    if (!descripcion || !(cantidad > 0) || !(precioUnitario > 0)) {
      throw new ErrorValidacion(`El ítem ${i + 1} necesita descripción, cantidad y precio unitario positivos.`);
    }
    return { descripcion, cantidad, precioUnitario, unidad: typeof it?.unidad === "string" ? it.unidad : null };
  });
  return {
    proveedor: typeof t.proveedor === "string" ? t.proveedor.slice(0, 120) : null,
    fecha: typeof t.fecha === "string" ? t.fecha.slice(0, 10) : null,
    items,
  };
}
