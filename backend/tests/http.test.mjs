import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ErrorServicioExterno, ErrorValidacion } from "../functions/obtenerClima/clima.mjs";
import { crearHandler, resolverUsuarioID } from "../functions/obtenerClima/http.mjs";

const logSilencioso = { info() {}, warn() {}, error() {} };

const eventoJwt = (sub) => ({ requestContext: { authorizer: { jwt: { claims: { sub } } } } });
const eventoQuery = (usuarioID) => ({ requestContext: {}, queryStringParameters: { usuarioID } });

function crearServicioFalso({ obtener, refrescar } = {}) {
  return {
    llamadoCon: null,
    async obtenerClimaUsuario(usuarioID) {
      this.llamadoCon = usuarioID;
      return obtener ? obtener(usuarioID) : { usuarioID, dias: [] };
    },
    async refrescarTodos() {
      return refrescar ? refrescar() : { total: 0, actualizados: 0, omitidos: 0, fallidos: [] };
    },
  };
}

describe("resolverUsuarioID", () => {
  it("prioriza el sub del JWT por sobre el query string", () => {
    const evento = { ...eventoJwt("sub-cognito"), queryStringParameters: { usuarioID: "intruso" } };
    assert.equal(resolverUsuarioID(evento, { permitirUsuarioQuery: true }), "sub-cognito");
  });

  it("ignora el query string si el modo desarrollo está desactivado", () => {
    assert.equal(resolverUsuarioID(eventoQuery("user_test_123"), { permitirUsuarioQuery: false }), null);
  });

  it("acepta el query string en modo desarrollo", () => {
    assert.equal(resolverUsuarioID(eventoQuery("user_test_123"), { permitirUsuarioQuery: true }), "user_test_123");
  });
});

describe("handler", () => {
  it("responde 200 con el clima del usuario autenticado", async () => {
    const servicio = crearServicioFalso();
    const handler = crearHandler({ servicio, log: logSilencioso });

    const res = await handler(eventoJwt("abc"));
    assert.equal(res.statusCode, 200);
    assert.equal(servicio.llamadoCon, "abc");
    assert.equal(JSON.parse(res.body).usuarioID, "abc");
  });

  it("responde 401 sin identidad", async () => {
    const handler = crearHandler({ servicio: crearServicioFalso(), log: logSilencioso });
    const res = await handler({ requestContext: {} });
    assert.equal(res.statusCode, 401);
  });

  it("mapea ErrorValidacion a 400", async () => {
    const servicio = crearServicioFalso({
      obtener: () => {
        throw new ErrorValidacion("sin ubicación");
      },
    });
    const res = await crearHandler({ servicio, log: logSilencioso })(eventoJwt("abc"));
    assert.equal(res.statusCode, 400);
  });

  it("mapea ErrorServicioExterno a 502", async () => {
    const servicio = crearServicioFalso({
      obtener: () => {
        throw new ErrorServicioExterno("Open-Meteo caído");
      },
    });
    const res = await crearHandler({ servicio, log: logSilencioso })(eventoJwt("abc"));
    assert.equal(res.statusCode, 502);
  });

  it("no filtra detalles de errores inesperados (500 genérico)", async () => {
    const servicio = crearServicioFalso({
      obtener: () => {
        throw new Error("AccessDeniedException: arn:aws:dynamodb:...");
      },
    });
    const res = await crearHandler({ servicio, log: logSilencioso })(eventoJwt("abc"));
    assert.equal(res.statusCode, 500);
    assert.doesNotMatch(res.body, /arn:aws/);
  });

  it("ante un evento de EventBridge ejecuta el refresco masivo", async () => {
    const resumen = { total: 2, actualizados: 2, omitidos: 0, fallidos: [] };
    const servicio = crearServicioFalso({ refrescar: () => resumen });
    const res = await crearHandler({ servicio, log: logSilencioso })({
      source: "aws.events",
      "detail-type": "Scheduled Event",
    });
    assert.deepEqual(res, resumen);
  });
});
