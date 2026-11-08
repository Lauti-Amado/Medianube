
import userPool from "./cognito";
import type { CognitoUserSession } from "amazon-cognito-identity-js";

// ── Tipos del dominio ────────────────────────────────────────────────────────

export type Confianza = "alta" | "media" | "baja";
export type UnidadBase = "kg" | "l" | "u";
export type EstadoPrecio = "estable" | "ajustar";

export interface ResultadoAplicarPrecio {
  success: boolean;
  mensaje: string;
  sugerenciaPrecioID: string;
  productoID: string;
  precioAnterior: number;
  precioNuevo: number;
  fechaAplicacion: string;
  estadoAplicacion: "aplicada";
  estadoSugerencia: "parcial" | "aplicada";
}

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

// Respuesta real de la Lambda sugerirPrecios-dev.
export interface SugerenciaPrecio {
  productoID: string;
  nombre: string;
  unidadProducto: string;

  precioActual: number;
  costoActual: number;

  costoAnterior: number | null;
  variacionCosto: number | null;

  precioSugerido: number;
  variacionPrecio: number;

  // La Lambda devuelve 60 para representar un margen del 60%.
  margenResultante: number;

  razonamiento: string;
  confianza: Confianza;
  superaTopeSuba: boolean;

  // Compatibilidad temporal con la pantalla anterior.
  categoria: string | null;
  costoNuevo: number | null;
  variacionPct: number;
  estado: EstadoPrecio;
  justificacion: string;
  insumosAfectados: string[];
  ajustadoPorReglas: boolean;
  origen: "llm" | "reglas";
}

export interface ProductoSinCosto {
  productoID: string;
  motivo: string;
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
  success: boolean;
  mensaje: string;

  sugerenciaPrecioID: string;
  fechaGeneracion: string;
  estado: string;

  cantidadProductosAnalizados: number;
  cantidadSugerencias: number;
  cantidadProductosSinCosto: number;

  sugerencias: SugerenciaPrecio[];
  productosSinCosto: ProductoSinCosto[];

  // Compatibilidad temporal con la pantalla anterior.
  usuarioID: string;
  origen: "llm" | "reglas";
  versionPrompt: string;
  generadaEn: string;
  insumos: VariacionInsumo[];
  productosSinReceta: string[];
  degradado: boolean;
  motivoDegradacion: MotivoDegradacion | null;
  guardado: boolean;
}

// ── Presets de tickets ────────────────────────────────────────────────────────
// Se mantienen temporalmente porque precios.tsx todavía los importa.
// La Lambda actual no utiliza estos tickets: obtiene los datos de DynamoDB.

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
        {
          descripcion: "Harina 000 x 25 kg Cañuelas",
          cantidad: 4,
          precioUnitario: 8200,
          unidad: "kg",
        },
        {
          descripcion: "Manteca x 5 kg",
          cantidad: 2,
          precioUnitario: 6450,
          unidad: "kg",
        },
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
        {
          descripcion: "Manteca x 5 kg La Serenísima",
          cantidad: 3,
          precioUnitario: 6600,
          unidad: "kg",
        },
        {
          descripcion: "Dulce de leche repostero 4 kg",
          cantidad: 2,
          precioUnitario: 4500,
          unidad: "kg",
        },
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
        {
          descripcion: "Harina 000 x 25 kg",
          cantidad: 5,
          precioUnitario: 8400,
          unidad: "kg",
        },
        {
          descripcion: "Manteca x 5 kg industrial",
          cantidad: 2,
          precioUnitario: 6500,
          unidad: "kg",
        },
        {
          descripcion: "Azúcar común x 50 kg",
          cantidad: 1,
          precioUnitario: 12500,
          unidad: "kg",
        },
        {
          descripcion: "Levadura fresca x 500 g",
          cantidad: 6,
          precioUnitario: 1100,
          unidad: "u",
        },
      ],
    },
  },
];

// ── Autenticación Cognito ────────────────────────────────────────────────────

export async function obtenerTokenAuth(): Promise<string | null> {
  if (typeof window === "undefined") {
    return null;
  }

  // Primero intentamos obtener el token de la cookie.
  const match = document.cookie.match(
    /(?:^|;\s*)cognitoIdToken=([^;]+)/
  );

  if (match?.[1]) {
    return decodeURIComponent(match[1]);
  }

  // Si no existe la cookie, consultamos la sesión de Cognito.
  const cognitoUser = userPool.getCurrentUser();

  if (!cognitoUser) {
    return null;
  }

  return new Promise((resolve) => {
    cognitoUser.getSession(
      (err: Error | null, session: CognitoUserSession | null) => {
        if (!err && session?.isValid()) {
          resolve(session.getIdToken().getJwtToken());
        } else {
          resolve(null);
        }
      }
    );
  });
}

// ── Configuración del endpoint ────────────────────────────────────────────────

const DEFAULT_API_BASE =
  "https://1i2vqeifsi.execute-api.us-east-2.amazonaws.com";

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

// ── Funciones auxiliares de normalización ─────────────────────────────────────

function obtenerConfianza(valor: unknown): Confianza {
  if (valor === "alta" || valor === "media" || valor === "baja") {
    return valor;
  }

  return "baja";
}

function obtenerNumero(
  valor: unknown,
  valorAlternativo = 0
): number {
  const numero = Number(valor);

  return Number.isFinite(numero) ? numero : valorAlternativo;
}

function normalizarSugerencia(raw: any): SugerenciaPrecio {
  const precioActual = obtenerNumero(raw?.precioActual);
  const precioSugerido = obtenerNumero(
    raw?.precioSugerido,
    precioActual
  );

  const variacionPrecio = obtenerNumero(
    raw?.variacionPrecio,
    precioActual > 0
      ? Math.round(
          ((precioSugerido - precioActual) / precioActual) * 10000
        ) / 100
      : 0
  );

  const costoActual = obtenerNumero(raw?.costoActual);

  const costoAnterior =
    raw?.costoAnterior !== null &&
    raw?.costoAnterior !== undefined &&
    Number.isFinite(Number(raw.costoAnterior))
      ? Number(raw.costoAnterior)
      : null;

  const variacionCosto =
    raw?.variacionCosto !== null &&
    raw?.variacionCosto !== undefined &&
    Number.isFinite(Number(raw.variacionCosto))
      ? Number(raw.variacionCosto)
      : null;

  const razonamiento = String(
    raw?.razonamiento ?? raw?.justificacion ?? ""
  );

  return {
    productoID: String(raw?.productoID ?? ""),
    nombre: String(raw?.nombre ?? "Producto sin nombre"),
    unidadProducto: String(raw?.unidadProducto ?? "unidad"),

    precioActual,
    costoActual,

    costoAnterior,
    variacionCosto,

    precioSugerido,
    variacionPrecio,

    margenResultante: obtenerNumero(raw?.margenResultante),

    razonamiento,
    confianza: obtenerConfianza(raw?.confianza),
    superaTopeSuba: Boolean(raw?.superaTopeSuba),

    // Compatibilidad con la versión anterior de precios.tsx.
    categoria: null,
    costoNuevo: costoActual,
    variacionPct: variacionPrecio,
    estado:
      Math.abs(variacionPrecio) < 0.01 ? "estable" : "ajustar",
    justificacion: razonamiento,
    insumosAfectados: [],
    ajustadoPorReglas: false,
    origen: "llm",
  };
}

function normalizarProductoSinCosto(raw: any): ProductoSinCosto {
  if (typeof raw === "string") {
    return {
      productoID: raw,
      motivo: "No se pudo calcular el costo del producto.",
    };
  }

  return {
    productoID: String(raw?.productoID ?? ""),
    motivo: String(raw?.motivo ?? "No se pudo calcular el costo."),
  };
}

function normalizarInsumo(raw: any): VariacionInsumo {
  return {
    insumo: String(raw?.insumo ?? ""),
    descripcionTicket: String(
      raw?.descripcionTicket ?? raw?.descripcion ?? ""
    ),
    unidad:
      raw?.unidad === "kg" ||
      raw?.unidad === "l" ||
      raw?.unidad === "u"
        ? raw.unidad
        : "u",
    precioAnterior:
      typeof raw?.precioAnterior === "number"
        ? raw.precioAnterior
        : null,
    precioNuevo: obtenerNumero(raw?.precioNuevo ?? raw?.precio),
    variacionPct:
      typeof raw?.variacionPct === "number"
        ? raw.variacionPct
        : null,
    variacionVsPromedioPct:
      typeof raw?.variacionVsPromedioPct === "number"
        ? raw.variacionVsPromedioPct
        : null,
    certeza: obtenerConfianza(raw?.certeza),
  };
}

// ── Normalización de la respuesta de la Lambda ────────────────────────────────

export function normalizarResultadoPrecios(
  raw: unknown
): ResultadoPrecios {
  const resultadoVacio: ResultadoPrecios = {
    success: false,
    mensaje: "No se recibieron datos de la Lambda.",

    sugerenciaPrecioID: "",
    fechaGeneracion: new Date().toISOString(),
    estado: "pendiente",

    cantidadProductosAnalizados: 0,
    cantidadSugerencias: 0,
    cantidadProductosSinCosto: 0,

    sugerencias: [],
    productosSinCosto: [],

    // Compatibilidad temporal.
    usuarioID: "",
    origen: "reglas",
    versionPrompt: "",
    generadaEn: new Date().toISOString(),
    insumos: [],
    productosSinReceta: [],
    degradado: false,
    motivoDegradacion: null,
    guardado: false,
  };

  if (!raw || typeof raw !== "object") {
    return resultadoVacio;
  }

  // Algunas integraciones pueden devolver el body como JSON en texto.
  const obj = raw as Record<string, any>;

  if (typeof obj.body === "string") {
    try {
      return normalizarResultadoPrecios(JSON.parse(obj.body));
    } catch {
      return {
        ...resultadoVacio,
        mensaje: "La respuesta de AWS no contiene un JSON válido.",
      };
    }
  }

  const sugerenciasRaw = Array.isArray(obj.sugerencias)
    ? obj.sugerencias
    : [];

  const productosSinCostoRaw = Array.isArray(obj.productosSinCosto)
    ? obj.productosSinCosto
    : [];

  const sugerencias = sugerenciasRaw.map(normalizarSugerencia);
  const productosSinCosto =
    productosSinCostoRaw.map(normalizarProductoSinCosto);

  const fechaGeneracion =
    typeof obj.fechaGeneracion === "string"
      ? obj.fechaGeneracion
      : new Date().toISOString();

  const sugerenciaPrecioID =
    typeof obj.sugerenciaPrecioID === "string"
      ? obj.sugerenciaPrecioID
      : "";

  return {
    success: obj.success === true,
    mensaje: String(
      obj.mensaje ?? "Sugerencias procesadas."
    ),

    sugerenciaPrecioID,
    fechaGeneracion,
    estado: String(obj.estado ?? "pendiente"),

    cantidadProductosAnalizados: obtenerNumero(
      obj.cantidadProductosAnalizados
    ),
    cantidadSugerencias: obtenerNumero(
      obj.cantidadSugerencias,
      sugerencias.length
    ),
    cantidadProductosSinCosto: obtenerNumero(
      obj.cantidadProductosSinCosto,
      productosSinCosto.length
    ),

    sugerencias,
    productosSinCosto,

    // Compatibilidad temporal con la pantalla anterior.
    usuarioID: "",
    origen: "llm",
    versionPrompt: "",
    generadaEn: fechaGeneracion,
    insumos: Array.isArray(obj.insumos)
      ? obj.insumos.map(normalizarInsumo)
      : [],
    productosSinReceta: productosSinCosto.map(
      (producto) => producto.productoID
    ),
    degradado: false,
    motivoDegradacion: null,
    guardado: Boolean(sugerenciaPrecioID),
  };
}

// ── Consumo del endpoint de sugerencias ───────────────────────────────────────

export async function sugerirPreciosConIA(
  _ticket?: Ticket,
  _usuarioID?: string | null
): Promise<ResultadoPrecios> {
  const token = await obtenerTokenAuth();
  const endpoint = obtenerEndpointPrecios();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      // La Lambda obtiene los productos, recetas y gastos desde DynamoDB.
      body: JSON.stringify({}),
    });
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : String(err);

    if (
      errorMsg.includes("Failed to fetch") ||
      errorMsg.includes("ERR_FAILED")
    ) {
      throw new Error(
        `Error de conexión con AWS (${endpoint}). Verificá que la ruta esté desplegada en API Gateway y que CORS permita el origen de tu frontend.`
      );
    }

    throw new Error(`Error de red al consultar AWS: ${errorMsg}`);
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg =
      data &&
      typeof data === "object" &&
      typeof data.error === "string"
        ? data.error
        : `Error ${response.status}: no se pudieron generar las sugerencias.`;

    throw new Error(errorMsg);
  }

  const resultado = normalizarResultadoPrecios(data);

  if (!resultado.success) {
    throw new Error(
      resultado.mensaje || "La Lambda no pudo generar las sugerencias."
    );
  }

  return resultado;
}

export async function aplicarPrecioIndividual(
  sugerenciaPrecioID: string,
  productoID: string
): Promise<ResultadoAplicarPrecio> {
  if (!sugerenciaPrecioID || !productoID) {
    throw new Error(
      "Falta el identificador de la sugerencia o del producto."
    );
  }

  const token = await obtenerTokenAuth();

  if (!token) {
    throw new Error(
      "No se pudo obtener el token de autenticación. Iniciá sesión nuevamente."
    );
  }

  const apiBase = (
    process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_BASE
  ).replace(/\/+$/, "");

  const url = `${apiBase}/precios/aplicar`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      sugerenciaPrecioID,
      productoID,
    }),
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(
      data.mensaje ||
      data.error ||
      "No se pudo aplicar el precio."
    );
  }

  return data as ResultadoAplicarPrecio;
}
