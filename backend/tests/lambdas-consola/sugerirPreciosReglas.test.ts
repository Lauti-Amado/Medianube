import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";

import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// La clave se lee al cargar el módulo: se define antes del import dinámico.
process.env.GEMINI_API_KEY = "clave-de-prueba";
type Modulo = typeof import("../../lambdas-consola/sugerirPrecios-dev/index.mjs");
let lambda: Modulo;
before(async () => {
  lambda = await import("../../lambdas-consola/sugerirPrecios-dev/index.mjs");
});

type Comando = { constructor: { name: string }; input: Record<string, unknown> };

const sendOriginal = DynamoDBDocumentClient.prototype.send;
const fetchOriginal = globalThis.fetch;
afterEach(() => {
  DynamoDBDocumentClient.prototype.send = sendOriginal;
  globalThis.fetch = fetchOriginal;
});

// Pan: costo 500 y precio 1000 (margen 50%, bajo el objetivo). Medialuna: costo 200 y precio 1000 (80%).
const RECETAS = [
  { productoID: "pan", nombre: "Pan", ingredientes: [{ nombre: "harina", cantidad: 1, unidad: "kg" }] },
  { productoID: "medialuna", nombre: "Medialuna", ingredientes: [{ nombre: "manteca", cantidad: 100, unidad: "g" }] },
];
const PRODUCTOS = [
  { productoID: "pan", nombre: "Pan", precioActual: 1000, unidadProducto: "kg" },
  { productoID: "medialuna", nombre: "Medialuna", precioActual: 1000, unidadProducto: "unidad" },
];
const GASTOS = [
  { gastoID: "g1", categoria: "harina", cantidad: 1, unidad: "kg", monto: 500, fecha: "2026-11-01" },
  { gastoID: "g2", categoria: "manteca", cantidad: 1, unidad: "kg", monto: 2000, fecha: "2026-11-01" },
];

/** DynamoDB simulado: devuelve cada tabla y guarda lo que se escribe. */
function simularDynamo(tablas: Record<string, unknown[]> = { "Receta-nueva": RECETAS, Producto: PRODUCTOS, Gastos: GASTOS }) {
  const guardados: Record<string, unknown>[] = [];
  DynamoDBDocumentClient.prototype.send = (async (comando: Comando) => {
    if (comando.constructor.name === "ScanCommand") return { Items: tablas[String(comando.input.TableName)] ?? [] };
    if (comando.constructor.name === "PutCommand") guardados.push(comando.input.Item as Record<string, unknown>);
    return {};
  }) as unknown as typeof sendOriginal;
  return guardados;
}

const responderGemini = (respuesta: () => Promise<Response>) => {
  globalThis.fetch = (async () => respuesta()) as typeof fetch;
};

const textoGemini = (texto: string) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: texto }] } }] }), { status: 200 });

const recalcular = async () => {
  const r = await lambda.handler({ rawPath: "/precios/sugerir", requestContext: { http: { method: "POST", path: "/precios/sugerir" } }, body: "{}" });
  return { status: r.statusCode, body: JSON.parse(r.body) };
};

const precio = (body: { sugerencias: Array<{ productoID: string; precioSugerido: number }> }, id: string) =>
  body.sugerencias.find((s) => s.productoID === id)?.precioSugerido;

describe("preciosPorReglas", () => {
  it("lleva al margen objetivo los precios que no llegan y no baja los que ya llegan", () => {
    const { sugerencias } = lambda.preciosPorReglas([
      { productoID: "pan", precioActual: 1000, costoActual: 500 },
      { productoID: "medialuna", precioActual: 1000, costoActual: 200 },
    ]);
    assert.equal(sugerencias.find((s) => s.productoID === "pan")?.precioSugerido, 1250);
    assert.equal(sugerencias.find((s) => s.productoID === "medialuna")?.precioSugerido, 1000);
    assert.ok(sugerencias.every((s) => s.razonamiento.length > 0));
  });
});

describe("POST /precios/sugerir cuando la IA falla", () => {
  it("si Gemini responde con error calcula por reglas, responde 200 y lo guarda", async () => {
    const guardados = simularDynamo();
    responderGemini(async () => new Response(JSON.stringify({ error: { message: "cuota agotada" } }), { status: 429 }));

    const { status, body } = await recalcular();
    assert.equal(status, 200);
    assert.equal(body.origen, "reglas");
    assert.equal(body.degradado, true);
    assert.equal(body.motivoDegradacion, "error_llm");
    assert.equal(precio(body, "pan"), 1250);
    assert.equal(precio(body, "medialuna"), 1000);
    assert.equal(guardados[0]?.origen, "reglas");
    assert.equal(guardados[0]?.motivoDegradacion, "error_llm");
  });

  it("si Gemini devuelve un JSON inválido, el motivo es esquema_invalido", async () => {
    simularDynamo();
    responderGemini(async () => textoGemini("esto no es json"));
    const { status, body } = await recalcular();
    assert.equal(status, 200);
    assert.equal(body.motivoDegradacion, "esquema_invalido");
  });

  it("si Gemini no contesta a tiempo, el motivo es timeout", async () => {
    simularDynamo();
    responderGemini(async () => {
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    });
    const { status, body } = await recalcular();
    assert.equal(status, 200);
    assert.equal(body.motivoDegradacion, "timeout");
  });

  it("si Gemini no deja ninguna sugerencia válida, también usa reglas", async () => {
    simularDynamo();
    responderGemini(async () => textoGemini(JSON.stringify({ sugerencias: [{ productoID: "inexistente", precioSugerido: 10 }] })));
    const { body } = await recalcular();
    assert.equal(body.origen, "reglas");
    assert.equal(body.motivoDegradacion, "esquema_invalido");
  });
});

describe("POST /precios/sugerir sin fallas", () => {
  it("con una respuesta válida de Gemini el origen es llm", async () => {
    simularDynamo();
    responderGemini(async () =>
      textoGemini(JSON.stringify({ sugerencias: [{ productoID: "pan", precioSugerido: 1300, razonamiento: "ok", confianza: "alta" }] }))
    );
    const { status, body } = await recalcular();
    assert.equal(status, 200);
    assert.equal(body.origen, "llm");
    assert.equal(body.degradado, false);
    assert.equal(body.motivoDegradacion, null);
    assert.equal(precio(body, "pan"), 1300);
  });

  it("los errores que no son de la IA siguen respondiendo 500", async () => {
    simularDynamo({ "Receta-nueva": [], Producto: PRODUCTOS, Gastos: GASTOS });
    const { status } = await recalcular();
    assert.equal(status, 500);
  });
});
