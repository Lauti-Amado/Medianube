// listarGastos: GET /compras. Historial de facturas del usuario logueado.
//
// Query string (todo opcional):
//   proveedor   búsqueda parcial, sin distinguir mayúsculas
//   desde/hasta AAAA-MM-DD; si el formato es inválido responde 400
//   estado      procesada | revisar | procesando
//   limite      tamaño de página (1 a 50). Si no viene, devuelve todos los gastos como antes
//               (lo siguen usando el Dashboard y el polling de la subida de facturas)
//   cursor      el `siguiente` de la página anterior
//
// Respuesta: { gastos, count, siguiente, resumen }
//   siguiente  cursor de la próxima página, o null si no hay más
//   resumen    KPIs sobre TODO el historial del usuario (ignora filtros y paginación). Solo viene en la
//              primera página: las siguientes no cambian los totales y así se ahorra una lectura completa.
//
// Lee el índice global `usuarioID-fecha-index` (PK usuarioID, SK fecha) de la tabla Gastos, del más nuevo al
// más viejo. La paginación es la de DynamoDB: Limit + ExclusiveStartKey; el cursor es la clave del último
// gasto devuelto, en base64url.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLA_GASTOS = process.env.TABLA_GASTOS || "Gastos";
const INDICE_USUARIO_FECHA = process.env.INDICE_USUARIO_FECHA || "usuarioID-fecha-index";
const ZONA_HORARIA = process.env.ZONA_HORARIA || "America/Argentina/Buenos_Aires";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

const LIMITE_MAXIMO = 50;
const ESTADOS = ["procesada", "revisar", "procesando"];
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

// ── Respuestas ────────────────────────────────────────────────────────────

function respuesta(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": CORS_ORIGIN,
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Allow-Methods": "OPTIONS,GET",
    },
    body: JSON.stringify(body),
  };
}

class ErrorDeEntrada extends Error {}

// ── Parámetros ────────────────────────────────────────────────────────────

/** El `sub` del ID token, validado por el authorizer JWT de API Gateway. */
export function usuarioDelEvento(event) {
  const sub = event?.requestContext?.authorizer?.jwt?.claims?.sub;
  return typeof sub === "string" && sub ? sub : null;
}

export function codificarCursor(clave) {
  return Buffer.from(JSON.stringify(clave)).toString("base64url");
}

/** Devuelve la ExclusiveStartKey; rechaza cursores rotos o de otro usuario. */
export function decodificarCursor(cursor, usuarioID) {
  let clave;
  try {
    clave = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new ErrorDeEntrada("El cursor de paginación es inválido.");
  }
  const valido =
    clave &&
    typeof clave.gastoID === "string" &&
    typeof clave.fecha === "string" &&
    clave.usuarioID === usuarioID;
  if (!valido) throw new ErrorDeEntrada("El cursor de paginación es inválido.");
  return { gastoID: clave.gastoID, usuarioID: clave.usuarioID, fecha: clave.fecha };
}

export function leerParametros(qs = {}, usuarioID) {
  const proveedor = (qs.proveedor ?? "").trim().toLowerCase();
  const desde = qs.desde?.trim() || null;
  const hasta = qs.hasta?.trim() || null;
  const estado = qs.estado?.trim() || null;

  for (const [nombre, valor] of [["desde", desde], ["hasta", hasta]]) {
    if (valor && !FECHA_ISO.test(valor)) {
      throw new ErrorDeEntrada(`El parámetro '${nombre}' debe tener el formato AAAA-MM-DD.`);
    }
  }
  if (desde && hasta && desde > hasta) {
    throw new ErrorDeEntrada("'desde' no puede ser posterior a 'hasta'.");
  }
  if (estado && !ESTADOS.includes(estado)) {
    throw new ErrorDeEntrada(`El parámetro 'estado' debe ser uno de: ${ESTADOS.join(", ")}.`);
  }

  let limite = null;
  if (qs.limite != null && qs.limite !== "") {
    limite = Number(qs.limite);
    if (!Number.isInteger(limite) || limite < 1 || limite > LIMITE_MAXIMO) {
      throw new ErrorDeEntrada(`El parámetro 'limite' debe ser un entero entre 1 y ${LIMITE_MAXIMO}.`);
    }
  }
  const cursor = qs.cursor ? decodificarCursor(qs.cursor, usuarioID) : null;
  if (cursor && limite == null) throw new ErrorDeEntrada("'cursor' requiere 'limite'.");

  return { proveedor, desde, hasta, estado, limite, cursor };
}

// ── Lectura ───────────────────────────────────────────────────────────────

/** Query del índice por usuario, con el rango de fechas como condición de clave. */
function consultaBase(usuarioID, desde, hasta) {
  const valores = { ":u": usuarioID };
  let condicion = "usuarioID = :u";
  if (desde && hasta) {
    condicion += " AND #fecha BETWEEN :desde AND :hasta";
    Object.assign(valores, { ":desde": desde, ":hasta": hasta });
  } else if (desde) {
    condicion += " AND #fecha >= :desde";
    valores[":desde"] = desde;
  } else if (hasta) {
    condicion += " AND #fecha <= :hasta";
    valores[":hasta"] = hasta;
  }
  return {
    TableName: TABLA_GASTOS,
    IndexName: INDICE_USUARIO_FECHA,
    KeyConditionExpression: condicion,
    // DynamoDB rechaza alias declarados que no se usan: `#fecha` solo va si hay rango de fechas
    ...((desde || hasta) && { ExpressionAttributeNames: { "#fecha": "fecha" } }),
    ExpressionAttributeValues: valores,
    ScanIndexForward: false, // más nuevo primero
  };
}

const estadoDe = (gasto) => gasto.estado || "procesada";

/** Proveedor y estado se filtran acá: DynamoDB no tiene `contains` sin distinguir mayúsculas. */
function coincide(gasto, { proveedor, estado }) {
  if (proveedor && !String(gasto.proveedor ?? "").toLowerCase().includes(proveedor)) return false;
  if (estado && estadoDe(gasto) !== estado) return false;
  return true;
}

/**
 * Junta hasta `limite` gastos que pasen los filtros. Pide uno de más para saber si hay otra página sin
 * devolver un `siguiente` que lleve a una página vacía. Sin `limite`, lee todo.
 */
async function leerGastos(usuarioID, filtros) {
  const { desde, hasta, limite, cursor } = filtros;
  const objetivo = limite == null ? Infinity : limite + 1;
  const gastos = [];
  let inicio = cursor ?? undefined;

  do {
    const pagina = await ddb.send(
      new QueryCommand({
        ...consultaBase(usuarioID, desde, hasta),
        ExclusiveStartKey: inicio,
        ...(limite != null && { Limit: objetivo - gastos.length }),
      })
    );
    for (const gasto of pagina.Items ?? []) {
      if (coincide(gasto, filtros)) gastos.push(gasto);
      if (gastos.length === objetivo) break;
    }
    inicio = pagina.LastEvaluatedKey;
  } while (inicio && gastos.length < objetivo);

  if (gastos.length <= (limite ?? Infinity)) return { gastos, siguiente: null };

  gastos.pop(); // el de más solo confirmaba que hay otra página
  const ultimo = gastos[gastos.length - 1];
  return {
    gastos,
    siguiente: codificarCursor({ gastoID: ultimo.gastoID, usuarioID: ultimo.usuarioID, fecha: ultimo.fecha }),
  };
}

/** "AAAA-MM" del mes actual y del anterior en la zona horaria del negocio. */
export function mesesDeReferencia(ahora, zonaHoraria = ZONA_HORARIA) {
  const [anio, mes] = new Intl.DateTimeFormat("en-CA", { timeZone: zonaHoraria, year: "numeric", month: "2-digit" })
    .format(ahora)
    .split("-")
    .map(Number);
  const dos = (n) => String(n).padStart(2, "0");
  return {
    actual: `${anio}-${dos(mes)}`,
    anterior: mes === 1 ? `${anio - 1}-12` : `${anio}-${dos(mes - 1)}`,
  };
}

// ── Sobreprecios ───────────────────────────────────────────────────────────

const UMBRAL_SOBREPRECIO_PCT = 5;

const normalizar = (texto) =>
  String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

/**
 * Cada compra de un insumo: los ítems que extrajo Gemini de la factura o, en las cargas sin ítems,
 * la categoría con su cantidad y monto. La clave junta el mismo insumo (sin mayúsculas ni tildes) y unidad.
 */
function comprasDeInsumos(gastos) {
  const compras = [];
  for (const gasto of gastos) {
    const fecha = String(gasto.fecha ?? "");
    if (!fecha) continue;
    const items = Array.isArray(gasto.items) ? gasto.items : [];
    if (items.length > 0) {
      for (const item of items) {
        const cantidad = Number(item?.cantidad);
        const precio = Number(item?.precio_unitario ?? item?.precioUnitario);
        const nombre = String(item?.descripcion ?? "").trim();
        if (nombre && cantidad > 0 && precio > 0) {
          compras.push({ clave: `${normalizar(nombre)}|${normalizar(item?.unidad)}`, nombre, fecha, cantidad, precio });
        }
      }
      continue;
    }
    const nombre = String(gasto.cetegoria ?? gasto.categoria ?? "").trim();
    const cantidad = Number(gasto.cantidad);
    const monto = Number(gasto.monto);
    if (nombre && cantidad > 0 && monto > 0) {
      compras.push({ clave: `${normalizar(nombre)}|${normalizar(gasto.unidad)}`, nombre, fecha, cantidad, precio: monto / cantidad });
    }
  }
  return compras;
}

/**
 * Lo pagado de más en las compras del mes: cada compra contra el promedio de las compras anteriores del
 * mismo insumo. Solo cuentan las subas mayores al umbral (5%); un insumo comprado por primera vez no tiene
 * con qué compararse. Devuelve el total en pesos y los insumos con suba, de mayor a menor (hasta 3).
 */
export function calcularSobreprecios(gastos, mesActual, umbralPct = UMBRAL_SOBREPRECIO_PCT) {
  const porInsumo = new Map();
  for (const compra of comprasDeInsumos(gastos)) {
    if (!porInsumo.has(compra.clave)) porInsumo.set(compra.clave, []);
    porInsumo.get(compra.clave).push(compra);
  }

  let total = 0;
  const subas = new Map();
  for (const [clave, compras] of porInsumo) {
    for (const compra of compras) {
      if (!compra.fecha.startsWith(mesActual)) continue;
      const anteriores = compras.filter((c) => c.fecha < compra.fecha);
      if (anteriores.length === 0) continue;
      const promedio = anteriores.reduce((acc, c) => acc + c.precio, 0) / anteriores.length;
      const variacion = (compra.precio / promedio - 1) * 100;
      if (variacion <= umbralPct) continue;
      total += (compra.precio - promedio) * compra.cantidad;
      if (!subas.has(clave) || subas.get(clave).variacionPct < variacion) {
        subas.set(clave, { nombre: compra.nombre, variacionPct: variacion });
      }
    }
  }

  return {
    total: Math.round(total),
    insumos: [...subas.values()]
      .sort((a, b) => b.variacionPct - a.variacionPct)
      .slice(0, 3)
      .map((s) => ({ nombre: s.nombre, variacionPct: Math.round(s.variacionPct * 10) / 10 })),
  };
}

/** Mismos KPIs que calculaba el frontend (`calcularResumen`), pero sobre todo el historial. */
export function calcularResumen(gastos, ahora) {
  const { actual, anterior } = mesesDeReferencia(ahora);
  let totalMes = 0;
  let facturasMes = 0;
  let totalAnterior = 0;
  let porRevisar = 0;

  for (const gasto of gastos) {
    const fecha = String(gasto.fecha ?? "");
    const monto = Number(gasto.monto) || 0;
    if (fecha.startsWith(actual)) {
      totalMes += monto;
      facturasMes += 1;
    } else if (fecha.startsWith(anterior)) {
      totalAnterior += monto;
    }
    if (estadoDe(gasto) === "revisar") porRevisar += 1;
  }

  return {
    totalMes,
    facturasMes,
    variacion: totalAnterior > 0 ? (totalMes / totalAnterior - 1) * 100 : null,
    porRevisar,
    sobreprecios: calcularSobreprecios(gastos, actual),
  };
}

async function leerResumen(usuarioID, ahora) {
  const gastos = [];
  const base = consultaBase(usuarioID, null, null);
  let inicio;
  do {
    const pagina = await ddb.send(
      new QueryCommand({
        ...base,
        // `items` y la categoría con cantidad y unidad alimentan el KPI de sobreprecios
        ProjectionExpression: "#fecha, monto, estado, #items, categoria, cetegoria, cantidad, unidad",
        ExpressionAttributeNames: { "#fecha": "fecha", "#items": "items" },
        ExclusiveStartKey: inicio,
      })
    );
    gastos.push(...(pagina.Items ?? []));
    inicio = pagina.LastEvaluatedKey;
  } while (inicio);
  return calcularResumen(gastos, ahora);
}

// ── Handler ───────────────────────────────────────────────────────────────

export async function handler(event) {
  if (event?.requestContext?.http?.method === "OPTIONS") return respuesta(204, {});

  const usuarioID = usuarioDelEvento(event);
  if (!usuarioID) return respuesta(401, { message: "Unauthorized" });

  let filtros;
  try {
    filtros = leerParametros(event?.queryStringParameters ?? {}, usuarioID);
  } catch (error) {
    if (error instanceof ErrorDeEntrada) return respuesta(400, { error: error.message });
    throw error;
  }

  try {
    const [{ gastos, siguiente }, resumen] = await Promise.all([
      leerGastos(usuarioID, filtros),
      filtros.cursor ? null : leerResumen(usuarioID, new Date()),
    ]);
    return respuesta(200, { gastos, count: gastos.length, siguiente, resumen });
  } catch (error) {
    console.error("Error al listar los gastos:", error);
    return respuesta(500, { error: "No se pudieron obtener los gastos." });
  }
}
