import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { crearDemandaRepositorioDynamo, mapearVenta } from "../../src/adapters/out/demandaRepositorioDynamo";
import { escribirEnLotes } from "../../src/adapters/out/dynamo";
import type { PrediccionGuardada } from "../../src/ports/demanda";

type Comando = { constructor: { name: string }; input: Record<string, unknown> };

function clienteFalso(responder: (c: Comando, n: number) => unknown = () => ({ Items: [] })) {
  const enviados: Array<{ nombre: string; input: Record<string, unknown> }> = [];
  const cliente = {
    send: async (comando: Comando) => {
      enviados.push({ nombre: comando.constructor.name, input: comando.input });
      return responder(comando, enviados.length);
    },
  } as unknown as DynamoDBDocumentClient;
  return { cliente, enviados };
}

describe("mapearVenta", () => {
  it("usa los atributos si están y la SK si faltan", () => {
    assert.deepEqual(mapearVenta({ fecha: "2026-10-31", productoID: "pan", cantidad: 12 }), {
      fecha: "2026-10-31",
      productoID: "pan",
      cantidad: 12,
    });
    assert.deepEqual(mapearVenta({ fechaProducto: "2026-10-30#medialuna", unidades: "40" }), {
      fecha: "2026-10-30",
      productoID: "medialuna",
      cantidad: 40,
    });
    assert.deepEqual(mapearVenta({ fechaProducto: "2026-10-29#torta", cantidadVendida: "2,5" })?.cantidad, 2.5);
  });

  it("descarta filas sin fecha, sin producto o con cantidad inválida", () => {
    assert.equal(mapearVenta({ fechaProducto: "sin-fecha", cantidad: 1 }), null);
    assert.equal(mapearVenta({ fecha: "2026-10-31", cantidad: 1 }), null);
    assert.equal(mapearVenta({ fechaProducto: "2026-10-31#pan", cantidad: -3 }), null);
    assert.equal(mapearVenta({ fechaProducto: "2026-10-31#pan" }), null);
  });
});

describe("repositorio DynamoDB de demanda", () => {
  it("consulta Ventas por rango de SK que incluye todo el último día", async () => {
    const { cliente, enviados } = clienteFalso(() => ({
      Items: [{ fechaProducto: "2026-10-31#pan", cantidad: 10 }, { fechaProducto: "basura" }],
    }));
    const repo = crearDemandaRepositorioDynamo({ tablaVentas: "V", tablaProductos: "P", tablaPredicciones: "X", cliente });

    const ventas = await repo.listarVentas("u", "2026-09-01", "2026-10-31");
    assert.deepEqual(ventas, [{ fecha: "2026-10-31", productoID: "pan", cantidad: 10 }]);
    assert.equal(enviados[0]!.nombre, "QueryCommand");
    assert.equal(enviados[0]!.input.TableName, "V");
    assert.deepEqual(enviados[0]!.input.ExpressionAttributeValues, {
      ":u": "u",
      ":desde": "2026-09-01",
      ":hasta": "2026-10-31#￿",
    });
  });

  it("pagina las consultas de productos", async () => {
    const { cliente, enviados } = clienteFalso((_, n) =>
      n === 1
        ? { Items: [{ productoID: "pan", nombre: "Pan francés" }], LastEvaluatedKey: { productoID: "pan" } }
        : { Items: [{ productoID: "torta" }] }
    );
    const repo = crearDemandaRepositorioDynamo({ tablaVentas: "V", tablaProductos: "P", tablaPredicciones: "X", cliente });

    assert.deepEqual(await repo.listarProductos("u"), [
      { productoID: "pan", nombre: "Pan francés" },
      { productoID: "torta", nombre: "torta" },
    ]);
    assert.equal(enviados.length, 2);
    assert.deepEqual(enviados[1]!.input.ExclusiveStartKey, { productoID: "pan" });
  });

  it("guarda predicciones con BatchWrite en lotes de 25", async () => {
    const { cliente, enviados } = clienteFalso(() => ({}));
    const repo = crearDemandaRepositorioDynamo({ tablaVentas: "V", tablaProductos: "P", tablaPredicciones: "X", cliente });
    const items = Array.from({ length: 30 }, (_, i) => ({ usuarioID: "u", fechaProducto: `2026-11-01#p${i}` }) as PrediccionGuardada);

    await repo.guardarPredicciones(items);
    assert.deepEqual(
      enviados.map((e) => (e.input.RequestItems as Record<string, unknown[]>).X!.length),
      [25, 5]
    );
    assert.ok(enviados.every((e) => e.nombre === "BatchWriteCommand"));
  });
});

describe("escribirEnLotes", () => {
  it("reintenta los ítems sin procesar y falla si nunca entran", async () => {
    const pendiente = { T: [{ PutRequest: { Item: { id: 1 } } }] };
    const ok = clienteFalso((_, n) => (n === 1 ? { UnprocessedItems: pendiente } : {}));
    await escribirEnLotes(ok.cliente, "T", [{ id: 1 }, { id: 2 }], { esperaBaseMs: 0 });
    assert.equal(ok.enviados.length, 2);
    assert.deepEqual(ok.enviados[1]!.input.RequestItems, pendiente);

    const nunca = clienteFalso(() => ({ UnprocessedItems: pendiente }));
    await assert.rejects(escribirEnLotes(nunca.cliente, "T", [{ id: 1 }], { esperaBaseMs: 0 }), /No se pudieron escribir/);
  });
});
