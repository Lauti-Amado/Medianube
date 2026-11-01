import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { crearPreciosRepositorioDynamo, mapearFactura, mapearProducto } from "../../src/adapters/out/preciosRepositorioDynamo";

describe("mapeo de facturas", () => {
  it("aplana los ítems y toma la fecha de la SK si no hay atributo fecha", () => {
    const compras = mapearFactura({
      usuarioID: "u",
      facturaID: "2026-10-20T10:00:00Z#abc",
      proveedor: "Molino",
      items: [
        { descripcion: "Harina 000 x 25 kg", cantidad: 4, precioUnitario: 8200 },
        { producto: "Manteca x 5 kg", cantidad: "2", precio_unitario: "6450,50", unidad: "kg" },
        { descripcion: "Sin precio" },
        { descripcion: "Gratis", precioUnitario: 0 },
      ],
    });
    assert.deepEqual(compras, [
      { insumo: "Harina 000 x 25 kg", fecha: "2026-10-20", precioUnitario: 8200, unidad: null, proveedor: "Molino" },
      { insumo: "Manteca x 5 kg", fecha: "2026-10-20", precioUnitario: 6450.5, unidad: "kg", proveedor: "Molino" },
    ]);
  });

  it("devuelve una lista vacía si la factura no tiene ítems", () => {
    assert.deepEqual(mapearFactura({ facturaID: "2026-10-20#x", monto: 1000 }), []);
  });
});

describe("mapeo de productos", () => {
  it("normaliza la receta y descarta ingredientes inválidos", () => {
    const p = mapearProducto({
      productoID: "medialuna",
      nombre: "Medialuna",
      precioActual: "420",
      receta: [
        { insumo: "Harina 000", cantidad: 50, unidad: "g" },
        { insumo: "Manteca", cantidad: 0, unidad: "g" },
      ],
      margenObjetivo: 1.5,
    });
    assert.deepEqual(p, {
      productoID: "medialuna",
      nombre: "Medialuna",
      categoria: null,
      precioActual: 420,
      receta: [{ insumo: "harina 000", cantidad: 50, unidad: "g" }],
      margenObjetivo: null,
    });
  });

  it("descarta productos sin precio", () => {
    assert.equal(mapearProducto({ productoID: "x", nombre: "X" }), null);
  });
});

describe("repositorio DynamoDB de precios", () => {
  it("consulta facturas por rango de SK y guarda sugerencias con UpdateItem condicional", async () => {
    const enviados: Array<{ nombre: string; input: Record<string, unknown> }> = [];
    const cliente = {
      send: async (comando: { constructor: { name: string }; input: Record<string, unknown> }) => {
        enviados.push({ nombre: comando.constructor.name, input: comando.input });
        return { Items: [] };
      },
    } as unknown as DynamoDBDocumentClient;
    const repo = crearPreciosRepositorioDynamo({
      tablaFacturas: "F",
      tablaProductos: "P",
      tablaConfiguracion: "C",
      cliente,
    });

    await repo.listarCompras("u", "2026-08-02");
    assert.equal(enviados[0]!.nombre, "QueryCommand");
    assert.equal(enviados[0]!.input.KeyConditionExpression, "#u = :u AND #f >= :desde");
    assert.deepEqual(enviados[0]!.input.ExpressionAttributeValues, { ":u": "u", ":desde": "2026-08-02" });

    await repo.guardarSugerencias("u", [{ productoID: "medialuna" } as never]);
    const update = enviados[1]!;
    assert.equal(update.nombre, "UpdateCommand");
    assert.deepEqual(update.input.Key, { usuarioID: "u", productoID: "medialuna" });
    assert.equal(update.input.ConditionExpression, "attribute_exists(productoID)");
  });
});
