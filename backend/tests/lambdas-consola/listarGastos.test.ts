import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  calcularResumen,
  calcularSobreprecios,
  codificarCursor,
  decodificarCursor,
  handler,
  mesesDeReferencia,
} from "../../lambdas-consola/listarGastos/index.mjs";

type Gasto = { gastoID: string; usuarioID: string; fecha: string; monto: number; proveedor: string; estado?: string };
type Query = {
  KeyConditionExpression: string;
  ExpressionAttributeValues: Record<string, string>;
  ExclusiveStartKey?: { gastoID: string; fecha: string };
  Limit?: number;
};

const sendOriginal = DynamoDBDocumentClient.prototype.send;
afterEach(() => {
  DynamoDBDocumentClient.prototype.send = sendOriginal;
});

/**
 * Simula el índice usuarioID-fecha-index: orden descendente, Limit y ExclusiveStartKey.
 * Como DynamoDB, devuelve LastEvaluatedKey cada vez que corta por Limit, aunque no queden más ítems.
 */
function simularIndice(tabla: Gasto[]) {
  const consultas: Query[] = [];
  DynamoDBDocumentClient.prototype.send = (async (comando: { input: Query }) => {
    const q = comando.input;
    consultas.push(q);
    const v = q.ExpressionAttributeValues;
    const orden = (a: Gasto, b: Gasto) => b.fecha.localeCompare(a.fecha) || b.gastoID.localeCompare(a.gastoID);
    let filas = tabla
      .filter((g) => g.usuarioID === v[":u"])
      .filter((g) => !v[":desde"] || g.fecha >= v[":desde"])
      .filter((g) => !v[":hasta"] || g.fecha <= v[":hasta"])
      .sort(orden);
    if (q.ExclusiveStartKey) {
      const i = filas.findIndex((g) => g.gastoID === q.ExclusiveStartKey!.gastoID);
      filas = filas.slice(i + 1);
    }
    if (q.Limit != null && filas.length >= q.Limit) {
      const items = filas.slice(0, q.Limit);
      const u = items[items.length - 1]!;
      return { Items: items, LastEvaluatedKey: { gastoID: u.gastoID, usuarioID: u.usuarioID, fecha: u.fecha } };
    }
    return { Items: filas };
  }) as unknown as typeof sendOriginal;
  return consultas;
}

const evento = (qs: Record<string, string> = {}, sub: string | null = "u1") => ({
  requestContext: { http: { method: "GET" }, ...(sub && { authorizer: { jwt: { claims: { sub } } } }) },
  queryStringParameters: qs,
});

async function pedir(qs: Record<string, string> = {}, sub: string | null = "u1") {
  const res = await handler(evento(qs, sub));
  return { status: res.statusCode, body: JSON.parse(res.body) };
}

/** 25 gastos de u1 (uno por día de noviembre) y 3 de otro usuario. */
const TABLA: Gasto[] = [
  ...Array.from({ length: 25 }, (_, i) => ({
    gastoID: `g${String(i + 1).padStart(2, "0")}`,
    usuarioID: "u1",
    fecha: `2026-11-${String(i + 1).padStart(2, "0")}`,
    monto: 100,
    proveedor: i % 5 === 0 ? "Molino Central" : "Lácteos Sur",
    ...(i % 4 === 0 && { estado: "revisar" }),
  })),
  ...["g90", "g91", "g92"].map((id) => ({ gastoID: id, usuarioID: "otro", fecha: "2026-11-10", monto: 999, proveedor: "Molino Central" })),
];

describe("listarGastos: paginación", () => {
  it("devuelve páginas de 10 del más nuevo al más viejo y la última sin cursor", async () => {
    simularIndice(TABLA);
    const p1 = await pedir({ limite: "10" });
    assert.equal(p1.status, 200);
    assert.deepEqual(p1.body.gastos.map((g: Gasto) => g.fecha.slice(8)), ["25", "24", "23", "22", "21", "20", "19", "18", "17", "16"]);
    assert.ok(p1.body.siguiente);

    const p2 = await pedir({ limite: "10", cursor: p1.body.siguiente });
    assert.equal(p2.body.gastos[0].gastoID, "g15");
    assert.equal(p2.body.count, 10);

    const p3 = await pedir({ limite: "10", cursor: p2.body.siguiente });
    assert.equal(p3.body.count, 5);
    assert.equal(p3.body.siguiente, null);
  });

  it("no ofrece otra página cuando los gastos justo completan la actual", async () => {
    simularIndice(TABLA.slice(0, 20));
    const p1 = await pedir({ limite: "10" });
    const p2 = await pedir({ limite: "10", cursor: p1.body.siguiente });
    assert.equal(p2.body.count, 10);
    assert.equal(p2.body.siguiente, null);
  });

  it("usa Limit y ExclusiveStartKey de DynamoDB", async () => {
    const consultas = simularIndice(TABLA);
    const p1 = await pedir({ limite: "10" });
    await pedir({ limite: "10", cursor: p1.body.siguiente });
    const pagina = consultas.filter((q) => q.Limit != null);
    assert.equal(pagina[0]!.Limit, 11);
    assert.equal(pagina[1]!.ExclusiveStartKey!.gastoID, "g16");
  });

  it("completa la página aunque el filtro de proveedor descarte ítems", async () => {
    simularIndice(TABLA);
    const p1 = await pedir({ limite: "3", proveedor: "molino" });
    assert.deepEqual(p1.body.gastos.map((g: Gasto) => g.gastoID), ["g21", "g16", "g11"]);
    const p2 = await pedir({ limite: "3", proveedor: "molino", cursor: p1.body.siguiente });
    assert.deepEqual(p2.body.gastos.map((g: Gasto) => g.gastoID), ["g06", "g01"]);
    assert.equal(p2.body.siguiente, null);
  });

  it("filtra por estado y rango de fechas", async () => {
    simularIndice(TABLA);
    const { body } = await pedir({ limite: "10", estado: "revisar", desde: "2026-11-05", hasta: "2026-11-17" });
    assert.deepEqual(body.gastos.map((g: Gasto) => g.gastoID), ["g17", "g13", "g09", "g05"]);
  });

  it("sin limite devuelve todo, como antes", async () => {
    simularIndice(TABLA);
    const { body } = await pedir();
    assert.equal(body.count, 25);
    assert.equal(body.siguiente, null);
  });
});

describe("listarGastos: resumen", () => {
  it("calcula los KPIs sobre todo el historial en la primera página y no en las siguientes", async () => {
    simularIndice(TABLA);
    const filtrada = await pedir({ limite: "2", proveedor: "molino" });
    assert.equal(filtrada.body.resumen.porRevisar, 7); // de los 25, no solo de la página filtrada
    const p2 = await pedir({ limite: "2", proveedor: "molino", cursor: filtrada.body.siguiente });
    assert.equal(p2.body.resumen, null);
  });

  it("suma el mes, cuenta las facturas por revisar y compara con el mes anterior", () => {
    const resumen = calcularResumen(
      [
        { fecha: "2026-11-10", monto: "1000", estado: "revisar" },
        { fecha: "2026-11-02", monto: 500 },
        { fecha: "2026-10-20", monto: 750 },
      ],
      new Date("2026-11-16T15:00:00Z")
    );
    assert.deepEqual(resumen, {
      totalMes: 1500,
      facturasMes: 2,
      variacion: 100,
      porRevisar: 1,
      sobreprecios: { total: 0, insumos: [] },
    });
  });

  it("toma el mes en la hora de Argentina", () => {
    // 1/12 a las 01:00 UTC todavía es 30/11 en Buenos Aires
    assert.deepEqual(mesesDeReferencia(new Date("2026-12-01T01:00:00Z"), "America/Argentina/Buenos_Aires"), {
      actual: "2026-11",
      anterior: "2026-10",
    });
    assert.deepEqual(mesesDeReferencia(new Date("2026-01-15T12:00:00Z"), "America/Argentina/Buenos_Aires"), {
      actual: "2026-01",
      anterior: "2025-12",
    });
  });
});

describe("listarGastos: validaciones", () => {
  it("responde 401 sin usuario del token", async () => {
    simularIndice(TABLA);
    assert.equal((await pedir({}, null)).status, 401);
  });

  it("responde 400 con fechas, límites o estados inválidos", async () => {
    simularIndice(TABLA);
    const invalidos: Record<string, string>[] = [{ desde: "10/11/2026" }, { desde: "2026-11-20", hasta: "2026-11-01" }, { limite: "0" }, { limite: "51" }, { estado: "otro" }];
    for (const qs of invalidos) {
      assert.equal((await pedir(qs)).status, 400, JSON.stringify(qs));
    }
  });

  it("rechaza un cursor de otro usuario o mal formado", () => {
    const ajeno = codificarCursor({ gastoID: "g90", usuarioID: "otro", fecha: "2026-11-10" });
    assert.throws(() => decodificarCursor(ajeno, "u1"));
    assert.throws(() => decodificarCursor("no-es-un-cursor", "u1"));
  });

  it("nunca devuelve gastos de otro usuario", async () => {
    simularIndice(TABLA);
    const { body } = await pedir({ proveedor: "molino" });
    assert.ok(body.gastos.every((g: Gasto) => g.usuarioID === "u1"));
  });
});

describe("listarGastos: sobreprecios", () => {
  const ahora = new Date("2026-11-26T15:00:00Z");
  const factura = (fecha: string, items: Array<Record<string, unknown>>) => ({ fecha, monto: 1, items });

  it("suma lo pagado de más en las compras del mes contra el promedio de las anteriores", () => {
    const resultado = calcularSobreprecios(
      [
        factura("2026-10-05", [{ descripcion: "Manteca x 5 kg", cantidad: 2, precio_unitario: 6000 }]),
        factura("2026-11-20", [{ descripcion: "manteca X 5 KG", cantidad: 3, precio_unitario: 6600 }]),
      ],
      "2026-11"
    );
    assert.deepEqual(resultado, { total: 1800, insumos: [{ nombre: "manteca X 5 KG", variacionPct: 10 }] });
  });

  it("ignora subas de hasta 5% y los insumos que se compran por primera vez", () => {
    const resultado = calcularSobreprecios(
      [
        factura("2026-10-05", [{ descripcion: "Harina 000", cantidad: 10, precio_unitario: 1000 }]),
        factura("2026-11-20", [
          { descripcion: "Harina 000", cantidad: 10, precio_unitario: 1040 },
          { descripcion: "Cacao", cantidad: 1, precio_unitario: 9000 },
        ]),
      ],
      "2026-11"
    );
    assert.deepEqual(resultado, { total: 0, insumos: [] });
  });

  it("usa las cargas sin ítems (categoría, cantidad y monto) y ordena los insumos por mayor suba", () => {
    const resultado = calcularSobreprecios(
      [
        { fecha: "2026-10-01", cetegoria: "huevos", cantidad: 30, unidad: "u", monto: 3000 },
        { fecha: "2026-11-10", cetegoria: "huevos", cantidad: 30, unidad: "u", monto: 3600 },
        factura("2026-10-02", [{ descripcion: "Azucar", cantidad: 5, precio_unitario: 1000 }]),
        factura("2026-11-11", [{ descripcion: "Azúcar", cantidad: 5, precio_unitario: 1100 }]),
      ],
      "2026-11"
    );
    assert.equal(resultado.total, 600 + 500);
    assert.deepEqual(
      resultado.insumos.map((i) => [i.nombre, i.variacionPct]),
      [
        ["huevos", 20],
        ["Azúcar", 10],
      ]
    );
  });

  it("el resumen lee los ítems de cada factura", async () => {
    const consultas: Array<{ ProjectionExpression?: string; ExpressionAttributeNames?: Record<string, string> }> = [];
    DynamoDBDocumentClient.prototype.send = (async (comando: { input: (typeof consultas)[number] }) => {
      consultas.push(comando.input);
      return { Items: [] };
    }) as unknown as typeof sendOriginal;
    await pedir({ limite: "5" });
    const resumen = consultas.find((q) => q.ProjectionExpression?.includes("#fecha, monto"));
    assert.ok(resumen, "no se pidió el resumen");
    assert.equal(resumen.ExpressionAttributeNames?.["#items"], "items");
    assert.ok(resumen.ProjectionExpression?.includes("#items"));
  });

  it("calcularResumen incluye los sobreprecios del mes", () => {
    const resumen = calcularResumen(
      [
        factura("2026-10-05", [{ descripcion: "Manteca", cantidad: 1, precio_unitario: 1000 }]),
        factura("2026-11-20", [{ descripcion: "Manteca", cantidad: 1, precio_unitario: 1200 }]),
      ],
      ahora
    );
    assert.deepEqual(resumen.sobreprecios, { total: 200, insumos: [{ nombre: "Manteca", variacionPct: 20 }] });
  });
});

describe("listarGastos: consultas válidas para DynamoDB", () => {
  /** DynamoDB rechaza los alias de ExpressionAttributeNames que no aparecen en ninguna expresión. */
  function aliasSinUsar(q: Record<string, unknown>): string[] {
    const nombres = Object.keys((q.ExpressionAttributeNames as Record<string, string> | undefined) ?? {});
    const expresiones = [q.KeyConditionExpression, q.ProjectionExpression, q.FilterExpression].filter(Boolean).join(" ");
    return nombres.filter((n) => !new RegExp(`${n}(?![A-Za-z0-9_])`).test(expresiones));
  }

  for (const [caso, qs] of [
    ["sin filtros", {}],
    ["paginado", { limite: "5" }],
    ["con fechas", { limite: "5", desde: "2026-11-01", hasta: "2026-11-30" }],
    ["solo desde", { desde: "2026-11-01" }],
  ] as const) {
    it(`no declara alias sin usar (${caso})`, async () => {
      const consultas: Array<Record<string, unknown>> = [];
      DynamoDBDocumentClient.prototype.send = (async (comando: { input: Record<string, unknown> }) => {
        consultas.push(comando.input);
        return { Items: [] };
      }) as unknown as typeof sendOriginal;
      await pedir(qs);
      assert.ok(consultas.length > 0);
      for (const q of consultas) assert.deepEqual(aliasSinUsar(q), [], JSON.stringify(q));
    });
  }
});
