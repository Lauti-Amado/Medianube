import userPool from "./cognito";
import type { CognitoUserSession } from "amazon-cognito-identity-js";

// ── Tipos del Dominio de Precios ─────────────────────────────────────────────

export type Confianza = "alta" | "media" | "baja";
export type UnidadBase = "kg" | "l" | "u";
export type EstadoPrecio = "estable" | "ajustar";

export interface ItemTicket {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  unidad?: string | null;
}

export interface Ticket {
  proveedor?: string | null;
  fecha?: string | null;
  items: ItemTicket[];
}

export interface VariacionInsumo {
  insumo: string;
  descripcionTicket: string;
  unidad: UnidadBase;
  precioAnterior: number | null;
  precioNuevo: number;
  variacionPct: number | null;
  variacionVsPromedioPct: number | null;
  certeza: Confianza;
}

export interface SugerenciaPrecio {
  productoID: string;
  nombre: string;
  categoria: string | null;
  costoAnterior: number | null;
  costoNuevo: number | null;
  precioActual: number;
  precioSugerido: number;
  variacionPct: number;
  margenResultante: number | null;
  estado: EstadoPrecio;
  confianza: Confianza;
  justificacion: string;
  insumosAfectados: string[];
  ajustadoPorReglas: boolean;
  origen: "llm" | "reglas";
}

export type MotivoDegradacion =
  | "sin_api_key"
  | "sin_tiempo"
  | "timeout"
  | "no_disponible"
  | "error_llm"
  | "esquema_invalido"
  | string;

export interface ResultadoPrecios {
  usuarioID: string;
  origen: "llm" | "reglas";
  versionPrompt: string;
  generadaEn: string;
  insumos: VariacionInsumo[];
  sugerencias: SugerenciaPrecio[];
  productosSinReceta: string[];
  degradado: boolean;
  motivoDegradacion: MotivoDegradacion | null;
  guardado: boolean;
}

// ── Presets de Tickets de Compra para Análisis ───────────────────────────────

export interface TicketPreset {
  id: string;
  nombre: string;
  descripcion: string;
  ticket: Ticket;
}

export const TICKETS_PREDETERMINADOS: TicketPreset[] = [
  {
    id: "canuelas",
    nombre: "Molino Cañuelas (Harina y Manteca)",
    descripcion: "Aumento reciente en insumos clave de panadería y pastelería",
    ticket: {
      proveedor: "Molino Cañuelas S.A.",
      fecha: new Date().toISOString().slice(0, 10),
      items: [
        { descripcion: "Harina 000 x 25 kg Cañuelas", cantidad: 4, precioUnitario: 8200, unidad: "kg" },
        { descripcion: "Manteca x 5 kg", cantidad: 2, precioUnitario: 6450, unidad: "kg" },
      ],
    },
  },
  {
    id: "lacteos",
    nombre: "Lácteos La Pampa (Manteca y Dulce)",
    descripcion: "Suba en derivados lácteos y repostería",
    ticket: {
      proveedor: "Lácteos La Pampa",
      fecha: new Date().toISOString().slice(0, 10),
      items: [
        { descripcion: "Manteca x 5 kg La Serenísima", cantidad: 3, precioUnitario: 6600, unidad: "kg" },
        { descripcion: "Dulce de leche repostero 4 kg", cantidad: 2, precioUnitario: 4500, unidad: "kg" },
      ],
    },
  },
  {
    id: "panaderia_general",
    nombre: "Insumos Panadería Completa",
    descripcion: "Harina, manteca, azúcar y levadura fresca",
    ticket: {
      proveedor: "Distribuidora San Justo",
      fecha: new Date().toISOString().slice(0, 10),
      items: [
        { descripcion: "Harina 000 x 25 kg", cantidad: 5, precioUnitario: 8400, unidad: "kg" },
        { descripcion: "Manteca x 5 kg industrial", cantidad: 2, precioUnitario: 6500, unidad: "kg" },
        { descripcion: "Azúcar común x 50 kg", cantidad: 1, precioUnitario: 12500, unidad: "kg" },
        { descripcion: "Levadura fresca x 500 g", cantidad: 6, precioUnitario: 1100, unidad: "u" },
      ],
    },
  },
];

// ── Obtención del Token de Autenticación ──────────────────────────────────────

export async function obtenerTokenAuth(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  // 1. Cookie cognitoIdToken sincronizada por el AuthProvider
  const match = document.cookie.match(/(?:^|;\s*)cognitoIdToken=([^;]+)/);
  if (match && match[1]) {
    return decodeURIComponent(match[1]);
  }

  // 2. Sesión activa de Amazon Cognito
  const cognitoUser = userPool.getCurrentUser();
  if (cognitoUser) {
    return new Promise((resolve) => {
      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (!err && session?.isValid()) {
          resolve(session.getIdToken().getJwtToken());
        } else {
          resolve(null);
        }
      });
    });
  }

  return null;
}

// ── Consumo del Endpoint de Sugerencias de Precios ───────────────────────────

const DEFAULT_API_BASE = "https://1i2vqeifsi.execute-api.us-east-2.amazonaws.com";

function obtenerEndpointPrecios(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  const rawBase = envUrl || DEFAULT_API_BASE;
  const baseLimpia = rawBase.replace(/\/+$/, "");

  if (baseLimpia.endsWith("/precios/sugerir")) {
    return baseLimpia;
  }
  if (baseLimpia.endsWith("/precios")) {
    return `${baseLimpia}/sugerir`;
  }
  return `${baseLimpia}/precios/sugerir`;
}

// ── Normalización Defensiva de Respuestas ───────────────────────────────────

function normalizarSugerencia(raw: any): SugerenciaPrecio {
  if (!raw || typeof raw !== "object") {
    return {
      productoID: "",
      nombre: "Producto desconocido",
      categoria: null,
      costoAnterior: null,
      costoNuevo: null,
      precioActual: 0,
      precioSugerido: 0,
      variacionPct: 0,
      margenResultante: null,
      estado: "ajustar",
      confianza: "baja",
      justificacion: "",
      insumosAfectados: [],
      ajustadoPorReglas: false,
      origen: "reglas",
    };
  }

  const precioActual = Number(raw.precioActual ?? raw.precio ?? 0);
  const precioSugerido = Number(raw.precioSugerido ?? raw.precioNuevo ?? precioActual);
  const variacionPct =
    typeof raw.variacionPct === "number"
      ? raw.variacionPct
      : typeof raw.variacionPorcentaje === "number"
      ? raw.variacionPorcentaje
      : precioActual > 0
      ? Math.round(((precioSugerido - precioActual) / precioActual) * 1000) / 10
      : 0;

  return {
    productoID: String(raw.productoID ?? raw.id ?? Math.random()),
    nombre: String(raw.nombre ?? raw.name ?? raw.producto ?? "Producto"),
    categoria: raw.categoria ? String(raw.categoria) : null,
    costoAnterior: typeof raw.costoAnterior === "number" ? raw.costoAnterior : null,
    costoNuevo:
      typeof raw.costoNuevo === "number"
        ? raw.costoNuevo
        : typeof raw.costo === "number"
        ? raw.costo
        : null,
    precioActual,
    precioSugerido,
    variacionPct,
    margenResultante: typeof raw.margenResultante === "number" ? raw.margenResultante : null,
    estado: raw.estado === "estable" ? "estable" : "ajustar",
    confianza: raw.confianza === "alta" || raw.confianza === "media" ? raw.confianza : "baja",
    justificacion: String(raw.justificacion ?? raw.justificacionIA ?? ""),
    insumosAfectados: Array.isArray(raw.insumosAfectados)
      ? raw.insumosAfectados.map(String)
      : Array.isArray(raw.insumos)
      ? raw.insumos.map((i: any) => (typeof i === "string" ? i : String(i.insumo || "")))
      : [],
    ajustadoPorReglas: Boolean(raw.ajustadoPorReglas),
    origen: raw.origen === "llm" ? "llm" : "reglas",
  };
}

function normalizarInsumo(raw: any): VariacionInsumo {
  return {
    insumo: String(raw?.insumo ?? ""),
    descripcionTicket: String(raw?.descripcionTicket ?? raw?.descripcion ?? ""),
    unidad: raw?.unidad === "kg" || raw?.unidad === "l" || raw?.unidad === "u" ? raw.unidad : "u",
    precioAnterior: typeof raw?.precioAnterior === "number" ? raw.precioAnterior : null,
    precioNuevo: Number(raw?.precioNuevo ?? raw?.precio ?? 0),
    variacionPct: typeof raw?.variacionPct === "number" ? raw.variacionPct : null,
    variacionVsPromedioPct:
      typeof raw?.variacionVsPromedioPct === "number" ? raw.variacionVsPromedioPct : null,
    certeza: raw?.certeza === "alta" || raw?.certeza === "media" ? raw.certeza : "baja",
  };
}

export function normalizarResultadoPrecios(raw: unknown): ResultadoPrecios {
  if (!raw || typeof raw !== "object") {
    return {
      usuarioID: "",
      origen: "reglas",
      versionPrompt: "",
      generadaEn: new Date().toISOString(),
      insumos: [],
      sugerencias: [],
      productosSinReceta: [],
      degradado: false,
      motivoDegradacion: null,
      guardado: false,
    };
  }

  // Si vino un array directo de sugerencias
  if (Array.isArray(raw)) {
    return {
      usuarioID: "",
      origen: "reglas",
      versionPrompt: "",
      generadaEn: new Date().toISOString(),
      insumos: [],
      sugerencias: raw.map(normalizarSugerencia),
      productosSinReceta: [],
      degradado: false,
      motivoDegradacion: null,
      guardado: false,
    };
  }

  const obj = raw as Record<string, unknown>;

  // Si el cuerpo viene como string JSON (Lambda proxy)
  if (typeof obj.body === "string") {
    try {
      const parsed = JSON.parse(obj.body);
      return normalizarResultadoPrecios(parsed);
    } catch {
      // Ignorar si no es JSON válido
    }
  }

  const sugerenciasRaw = Array.isArray(obj.sugerencias)
    ? obj.sugerencias
    : Array.isArray(obj.precios)
    ? obj.precios
    : [];

  const insumosRaw = Array.isArray(obj.insumos) ? obj.insumos : [];
  const sinRecetaRaw = Array.isArray(obj.productosSinReceta) ? obj.productosSinReceta : [];

  return {
    usuarioID: typeof obj.usuarioID === "string" ? obj.usuarioID : "",
    origen: obj.origen === "llm" ? "llm" : "reglas",
    versionPrompt: typeof obj.versionPrompt === "string" ? obj.versionPrompt : "",
    generadaEn: typeof obj.generadaEn === "string" ? obj.generadaEn : new Date().toISOString(),
    insumos: insumosRaw.map(normalizarInsumo),
    sugerencias: sugerenciasRaw.map(normalizarSugerencia),
    productosSinReceta: sinRecetaRaw.map(String),
    degradado: Boolean(obj.degradado),
    motivoDegradacion: typeof obj.motivoDegradacion === "string" ? obj.motivoDegradacion : null,
    guardado: Boolean(obj.guardado),
  };
}

export async function sugerirPreciosConIA(
  ticket: Ticket,
  usuarioID?: string | null
): Promise<ResultadoPrecios> {
  const token = await obtenerTokenAuth();

  const idUsuario = usuarioID || "user_test_123";
  const endpoint = obtenerEndpointPrecios();
  // Pasamos el usuarioID por query string para habilitar desarrollo/pruebas locales si no hay Authorizer activo
  const url = `${endpoint}?usuarioID=${encodeURIComponent(idUsuario)}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ ticket }),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.includes("Failed to fetch") || errorMsg.includes("ERR_FAILED")) {
      throw new Error(
        `Error de conexión con AWS (${endpoint}). Verificá que la ruta esté desplegada en API Gateway y que tenga CORS habilitado para peticiones POST con Content-Type y Authorization.`
      );
    }
    throw new Error(`Error de red al consultar AWS: ${errorMsg}`);
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg =
      (data && typeof data === "object" && "error" in data && typeof data.error === "string" && data.error) ||
      `Error ${response.status}: no se pudieron calcular las sugerencias de precios.`;
    throw new Error(errorMsg);
  }

  return normalizarResultadoPrecios(data);
}

