import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { crearHandlerPrecios } from "../../src/adapters/in/lambdaPrecios";
import type { ResultadoPrecios, ServicioPrecios } from "../../src/application/precios/servicioPrecios";
import { ErrorValidacion } from "../../src/domain/errores";

const RESULTADO: ResultadoPrecios = {
  usuarioID: "abc",
  origen: "llm",
  versionPrompt: "precios-v1",
  generadaEn: "2026-10-31T15:00:00.000Z",
  insumos: [],
  sugerencias: [],
  productosSinReceta: [],
};

const TICKET = { items: [{ descripcion: "Harina 000 x 25 kg", cantidad: 1, precioUnitario: 8200 }] };
const log = { info() {}, warn() {}, error() {} };

function servicioFalso(impl?: ServicioPrecios["sugerirPrecios"]) {
  const llamadas: Array<[string, unknown]> = [];
  const servicio: ServicioPrecios = {
    async sugerirPrecios(usuarioID, ticket) {
      llamadas.push([usuarioID, ticket]);
      return impl ? impl(usuarioID, ticket) : RESULTADO;
    },
  };
  return { servicio, llamadas };
}

const conJwt = (body: unknown, extra: object = {}) => ({
  body: JSON.stringify(body),
  requestContext: { authorizer: { jwt: { claims: { sub: "abc" } } } },
  ...extra,
});

describe("handler POST /precios/sugerir", () => {
  it("responde 200 con el resultado usando el sub del JWT", async () => {
    const { servicio, llamadas } = servicioFalso();
    const r = await crearHandlerPrecios({ servicio, log })(conJwt({ ticket: TICKET }));
    assert.equal(r.statusCode, 200);
    assert.deepEqual(JSON.parse(r.body), RESULTADO);
    assert.deepEqual(llamadas, [["abc", TICKET]]);
  });

  it("acepta cuerpos en base64", async () => {
    const { servicio, llamadas } = servicioFalso();
    const body = Buffer.from(JSON.stringify({ ticket: TICKET })).toString("base64");
    const r = await crearHandlerPrecios({ servicio, log })(conJwt(null, { body, isBase64Encoded: true }));
    assert.equal(r.statusCode, 200);
    assert.deepEqual(llamadas[0]![1], TICKET);
  });

  it("responde 401 sin identidad y solo acepta ?usuarioID= en modo dev", async () => {
    const { servicio } = servicioFalso();
    const evento = { body: JSON.stringify({ ticket: TICKET }), queryStringParameters: { usuarioID: "dev" } };
    assert.equal((await crearHandlerPrecios({ servicio, log })(evento)).statusCode, 401);
    assert.equal((await crearHandlerPrecios({ servicio, log, permitirUsuarioQuery: true })(evento)).statusCode, 200);
  });

  it("responde 400 con cuerpo faltante, JSON inválido o ticket inválido", async () => {
    const { servicio } = servicioFalso(async () => {
      throw new ErrorValidacion("El ticket debe tener al menos un ítem.");
    });
    const handler = crearHandlerPrecios({ servicio, log });
    const sinCuerpo = await handler({ requestContext: { authorizer: { jwt: { claims: { sub: "abc" } } } } });
    assert.equal(sinCuerpo.statusCode, 400);
    const invalido = await handler(conJwt(null, { body: "{no json" }));
    assert.equal(invalido.statusCode, 400);
    assert.match(JSON.parse(invalido.body).error, /JSON/);
    const ticketVacio = await handler(conJwt({ ticket: { items: [] } }));
    assert.deepEqual([ticketVacio.statusCode, JSON.parse(ticketVacio.body).error], [400, "El ticket debe tener al menos un ítem."]);
  });

  it("no filtra detalles de errores inesperados (500 genérico)", async () => {
    const { servicio } = servicioFalso(async () => {
      throw new Error("ProvisionedThroughputExceeded en tabla X");
    });
    const r = await crearHandlerPrecios({ servicio, log })(conJwt({ ticket: TICKET }));
    assert.deepEqual([r.statusCode, JSON.parse(r.body)], [500, { error: "Error interno del servidor." }]);
  });
});
