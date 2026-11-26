// guardarConfiguracion: PUT /configuracion. Guarda la configuración del negocio del usuario logueado.
//
// La usan el último paso del onboarding y la pantalla de Configuración. Hace un UpdateItem sobre
// Medianube-Configuracion: solo escribe los campos que vienen en el body y no borra los demás
// (por ejemplo, la ubicación que lee el clima o datos que agreguen otras pantallas).
//
// Body (JSON, todos opcionales pero al menos uno):
//   nombreNegocio  texto, 1 a 100 caracteres
//   tipoLocal      texto, hasta 50 (lo manda el onboarding)
//   rubro          texto, hasta 50 (lo manda Configuración)
//   ciudad         texto, hasta 100
//   sucursales     entero de 1 a 100
//   margenes       { panaderia, pasteleria, bebidas }: % entre 0 y 99
//   ubicacion      { lat, lon, ciudad? }: el formato que lee obtenerClima (parsearUbicacion)
//
// Respuesta: 200 { configuracion } con el ítem completo después de guardar; 400 si el body es inválido;
// 401 sin usuario del token.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLA_CONFIGURACION = process.env.TABLA_CONFIGURACION || "Medianube-Configuracion";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

const CATEGORIAS_MARGEN = ["panaderia", "pasteleria", "bebidas"];

// ── Respuestas ────────────────────────────────────────────────────────────

function respuesta(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": CORS_ORIGIN,
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Allow-Methods": "OPTIONS,GET,PUT",
    },
    body: JSON.stringify(body),
  };
}

class ErrorDeEntrada extends Error {}

// ── Validación ────────────────────────────────────────────────────────────

/** El `sub` del ID token, validado por el authorizer JWT de API Gateway. */
export function usuarioDelEvento(event) {
  const sub = event?.requestContext?.authorizer?.jwt?.claims?.sub;
  return typeof sub === "string" && sub ? sub : null;
}

function texto(valor, campo, { min = 0, max }) {
  if (typeof valor !== "string") throw new ErrorDeEntrada(`'${campo}' tiene que ser un texto.`);
  const limpio = valor.trim();
  if (limpio.length < min || limpio.length > max) {
    throw new ErrorDeEntrada(
      min > 0 ? `'${campo}' tiene que tener entre ${min} y ${max} caracteres.` : `'${campo}' puede tener hasta ${max} caracteres.`
    );
  }
  return limpio;
}

function numero(valor, campo, { min, max, entero = false }) {
  const n = typeof valor === "string" && valor.trim() !== "" ? Number(valor) : valor;
  if (typeof n !== "number" || !Number.isFinite(n) || (entero && !Number.isInteger(n)) || n < min || n > max) {
    throw new ErrorDeEntrada(`'${campo}' tiene que ser un ${entero ? "entero" : "número"} entre ${min} y ${max}.`);
  }
  return n;
}

/** Devuelve solo los campos permitidos, validados y normalizados. */
export function leerCambios(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ErrorDeEntrada("El body tiene que ser un objeto JSON.");
  }
  const cambios = {};

  if (body.nombreNegocio !== undefined) cambios.nombreNegocio = texto(body.nombreNegocio, "nombreNegocio", { min: 1, max: 100 });
  if (body.tipoLocal !== undefined) cambios.tipoLocal = texto(body.tipoLocal, "tipoLocal", { max: 50 });
  if (body.rubro !== undefined) cambios.rubro = texto(body.rubro, "rubro", { max: 50 });
  if (body.ciudad !== undefined) cambios.ciudad = texto(body.ciudad, "ciudad", { max: 100 });
  if (body.sucursales !== undefined) cambios.sucursales = numero(body.sucursales, "sucursales", { min: 1, max: 100, entero: true });

  if (body.margenes !== undefined) {
    const m = body.margenes;
    if (!m || typeof m !== "object") throw new ErrorDeEntrada("'margenes' tiene que ser un objeto.");
    cambios.margenes = Object.fromEntries(
      CATEGORIAS_MARGEN.map((c) => [c, numero(m[c], `margenes.${c}`, { min: 0, max: 99 })])
    );
  }

  if (body.ubicacion !== undefined) {
    const u = body.ubicacion;
    if (!u || typeof u !== "object") throw new ErrorDeEntrada("'ubicacion' tiene que ser un objeto.");
    cambios.ubicacion = {
      lat: numero(u.lat, "ubicacion.lat", { min: -90, max: 90 }),
      lon: numero(u.lon, "ubicacion.lon", { min: -180, max: 180 }),
      ...(u.ciudad != null && { ciudad: texto(u.ciudad, "ubicacion.ciudad", { max: 100 }) }),
    };
  }

  if (Object.keys(cambios).length === 0) throw new ErrorDeEntrada("No hay ningún campo para guardar.");
  return cambios;
}

/** UpdateItem que solo toca los campos recibidos; crea el ítem si el usuario todavía no tiene uno. */
export function armarActualizacion(usuarioID, cambios, ahora) {
  const nombres = { "#actualizadoEn": "actualizadoEn", "#creadoEn": "creadoEn" };
  const valores = { ":ahora": ahora };
  const sets = ["#actualizadoEn = :ahora", "#creadoEn = if_not_exists(#creadoEn, :ahora)"];
  for (const [campo, valor] of Object.entries(cambios)) {
    nombres[`#${campo}`] = campo;
    valores[`:${campo}`] = valor;
    sets.push(`#${campo} = :${campo}`);
  }
  return {
    TableName: TABLA_CONFIGURACION,
    Key: { usuarioID },
    UpdateExpression: `SET ${sets.join(", ")}`,
    ExpressionAttributeNames: nombres,
    ExpressionAttributeValues: valores,
    ReturnValues: "ALL_NEW",
  };
}

// ── Handler ───────────────────────────────────────────────────────────────

export async function handler(event) {
  if (event?.requestContext?.http?.method === "OPTIONS") return respuesta(204, {});

  const usuarioID = usuarioDelEvento(event);
  if (!usuarioID) return respuesta(401, { message: "Unauthorized" });

  let cambios;
  try {
    let body;
    try {
      const crudo = event?.isBase64Encoded ? Buffer.from(event.body ?? "", "base64").toString("utf8") : event?.body;
      body = JSON.parse(crudo || "null");
    } catch {
      throw new ErrorDeEntrada("El body no es un JSON válido.");
    }
    cambios = leerCambios(body);
  } catch (error) {
    if (error instanceof ErrorDeEntrada) return respuesta(400, { message: error.message });
    throw error;
  }

  try {
    const { Attributes } = await ddb.send(new UpdateCommand(armarActualizacion(usuarioID, cambios, new Date().toISOString())));
    return respuesta(200, { configuracion: Attributes });
  } catch (error) {
    console.error("Error al guardar la configuración:", error);
    return respuesta(500, { message: "No se pudo guardar la configuración." });
  }
}
