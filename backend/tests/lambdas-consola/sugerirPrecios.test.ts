import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { elegirUltimaSugerencia, handler } from "../../lambdas-consola/sugerirPrecios-dev/index.mjs";

type Comando = { constructor: { name: string }; input: Record<string, unknown> };

const sendOriginal = DynamoDBDocumentClient.prototype.send;
afterEach(() => {
  DynamoDBDocumentClient.prototype.send = sendOriginal;
});

/** Reemplaza las llamadas a DynamoDB y registra los comandos enviados. */
function simularDynamo(responder: (c: Comando) => unknown) {
  const enviados: Comando[] = [];
  DynamoDBDocumentClient.prototype.send = (async (comando: Comando) => {
    enviados.push(comando);
    return responder(comando);
  }) as unknown as typeof sendOriginal;
  return enviados;
}

const evento = (method: string, path = "/precios/sugerir") => ({ rawPath: path, requestContext: { http: { method, path } } });

const fila = (id: string, fechaGeneracion: unknown, sugerencias: unknown[] = []) => ({
  sugerenciaPrecioID: id,
  fechaGeneracion,
  estado: "pendiente",
  sugerencias,
});

describe("elegirUltimaSugerencia", () => {
  it("devuelve la sugerencia con la fecha de generación más reciente", () => {
    const ultima = elegirUltimaSugerencia([
      fila("a", "2026-11-10T10:00:00.000Z"),
      fila("b", "2026-11-15T10:00:00.000Z"),
      fila("c", "2026-11-12T10:00:00.000Z"),
    ]);
    assert.equal(ultima?.sugerenciaPrecioID, "b");
  });

  it("ignora las filas sin fecha o con una fecha que no se puede leer", () => {
    assert.equal(elegirUltimaSugerencia([fila("a", undefined), fila("b", "ayer")]), null);
    assert.equal(elegirUltimaSugerencia([]), null);
  });
});

describe("GET /precios/sugerir", () => {
  it("devuelve la última sugerencia guardada sin llamar a la IA", async () => {
    const aplicada = { productoID: "pan", precioSugerido: 1500, estadoAplicacion: "aplicada" };
    const pendiente = { productoID: "medialuna", precioSugerido: 900 };
    const enviados = simularDynamo(() => ({
      Items: [fila("vieja", "2026-11-01T10:00:00.000Z"), fila("nueva", "2026-11-15T10:00:00.000Z", [aplicada, pendiente])],
    }));

    const respuesta = await handler(evento("GET"));
    const body = JSON.parse(respuesta.body);

    assert.equal(respuesta.statusCode, 200);
    assert.equal(body.success, true);
    assert.equal(body.sugerenciaPrecioID, "nueva");
    assert.equal(body.fechaGeneracion, "2026-11-15T10:00:00.000Z");
    assert.equal(body.cantidadSugerencias, 2);
    assert.deepEqual(body.sugerencias[0], aplicada);
    assert.deepEqual(body.productosSinCosto, []);
    assert.ok(enviados.every((c) => c.constructor.name === "ScanCommand"));
    assert.equal(enviados[0]!.input.TableName, "Sugerencia-precio");
  });

  it("sin sugerencias guardadas responde 200 con la lista vacía", async () => {
    simularDynamo(() => ({ Items: [] }));
    const respuesta = await handler(evento("GET"));
    const body = JSON.parse(respuesta.body);
    assert.equal(respuesta.statusCode, 200);
    assert.equal(body.success, true);
    assert.equal(body.sugerenciaPrecioID, null);
    assert.deepEqual(body.sugerencias, []);
  });

  it("si DynamoDB falla responde 500", async () => {
    simularDynamo(() => {
      throw new Error("sin conexión");
    });
    const respuesta = await handler(evento("GET"));
    assert.equal(respuesta.statusCode, 500);
    assert.equal(JSON.parse(respuesta.body).success, false);
  });
});

describe("métodos y CORS", () => {
  it("rechaza otros métodos y permite GET en CORS", async () => {
    const respuesta = await handler(evento("PUT"));
    assert.equal(respuesta.statusCode, 405);
    assert.equal(respuesta.headers["Access-Control-Allow-Methods"], "OPTIONS,GET,POST");
  });
});
