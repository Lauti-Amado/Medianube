import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { crearHandlerClima, resolverUsuarioID } from "../../src/adapters/in/lambdaClima";
import type { EventoLambda, RespuestaHttp } from "../../src/adapters/in/lambdaClima";
import type { ResultadoClima, ResumenRefresco, ServicioClima } from "../../src/application/clima/servicioClima";
import { ErrorServicioExterno, ErrorValidacion } from "../../src/domain/clima/tipos";

const logSilencioso = { info() {}, warn() {}, error() {} };

const eventoJwt = (sub: string): EventoLambda => ({ requestContext: { authorizer: { jwt: { claims: { sub } } } } });
const eventoQuery = (usuarioID: string): EventoLambda => ({ requestContext: {}, queryStringParameters: { usuarioID } });

function crearServicioFalso({
  obtener,
  refrescar,
}: {
  obtener?: (usuarioID: string) => ResultadoClima;
  refrescar?: () => ResumenRefresco;
} = {}) {
  return {
    llamadoCon: null as string | null,
    async obtenerClimaUsuario(usuarioID: string) {
      this.llamadoCon = usuarioID;
      return obtener ? obtener(usuarioID) : ({ usuarioID, dias: [] } as unknown as ResultadoClima);
    },
    async refrescarTodos() {
      return refrescar ? refrescar() : { total: 0, actualizados: 0, omitidos: 0, omitidosPorProveedor: 0, pendientes: 0, fallidos: [] };
    },
  } satisfies ServicioClima & { llamadoCon: string | null };
}

describe("resolverUsuarioID", () => {
  it("prioriza el sub del JWT por sobre el query string", () => {
    const evento: EventoLambda = { ...eventoJwt("sub-cognito"), queryStringParameters: { usuarioID: "intruso" } };
    assert.equal(resolverUsuarioID(evento, { permitirUsuarioQuery: true }), "sub-cognito");
  });

  it("ignora el query string si el modo desarrollo está desactivado", () => {
    assert.equal(resolverUsuarioID(eventoQuery("user_test_123"), { permitirUsuarioQuery: false }), null);
  });

  it("acepta el query string en modo desarrollo", () => {
    assert.equal(resolverUsuarioID(eventoQuery("user_test_123"), { permitirUsuarioQuery: true }), "user_test_123");
  });
});

describe("handler de clima", () => {
  it("responde 200 con el clima del usuario autenticado", async () => {
    const servicio = crearServicioFalso();
    const handler = crearHandlerClima({ servicio, log: logSilencioso });

    const res = (await handler(eventoJwt("abc"))) as RespuestaHttp;
    assert.equal(res.statusCode, 200);
    assert.equal(servicio.llamadoCon, "abc");
    assert.equal(JSON.parse(res.body).usuarioID, "abc");
  });

  it("responde 401 sin identidad", async () => {
    const handler = crearHandlerClima({ servicio: crearServicioFalso(), log: logSilencioso });
    const res = (await handler({ requestContext: {} })) as RespuestaHttp;
    assert.equal(res.statusCode, 401);
  });

  it("mapea ErrorValidacion a 400", async () => {
    const servicio = crearServicioFalso({
      obtener: () => {
        throw new ErrorValidacion("sin ubicación");
      },
    });
    const res = (await crearHandlerClima({ servicio, log: logSilencioso })(eventoJwt("abc"))) as RespuestaHttp;
    assert.equal(res.statusCode, 400);
  });

  it("Open-Meteo caído sin cache: 200 degradado (nunca 502)", async () => {
    const servicio = crearServicioFalso({
      obtener: (usuarioID) =>
        ({ usuarioID, origen: "sin-datos", disponible: false, desactualizado: true, aviso: "x", dias: [] }) as unknown as ResultadoClima,
    });
    const res = (await crearHandlerClima({ servicio, log: logSilencioso })(eventoJwt("abc"))) as RespuestaHttp;
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).disponible, false);
  });

  it("un ErrorServicioExterno inesperado tampoco da 502: 500 JSON con requestId", async () => {
    const servicio = crearServicioFalso({
      obtener: () => {
        throw new ErrorServicioExterno("Open-Meteo caído");
      },
    });
    const handler = crearHandlerClima({ servicio, log: logSilencioso });
    const res = (await handler(eventoJwt("abc"), { awsRequestId: "req-9" })) as RespuestaHttp;
    assert.equal(res.statusCode, 500);
    assert.equal(JSON.parse(res.body).requestId, "req-9");
  });

  it("throttling de DynamoDB: 503 con Retry-After", async () => {
    const servicio = crearServicioFalso({
      obtener: () => {
        throw Object.assign(new Error("Rate exceeded"), { name: "ThrottlingException" });
      },
    });
    const res = (await crearHandlerClima({ servicio, log: logSilencioso })(eventoJwt("abc"))) as RespuestaHttp;
    assert.equal(res.statusCode, 503);
    assert.equal(res.headers["Retry-After"], "2");
  });

  it("pasa el tiempo restante de la invocación al refresco programado", async () => {
    let plazoRecibido: number | undefined;
    const servicio: ServicioClima = {
      ...crearServicioFalso(),
      async refrescarTodos(opciones) {
        plazoRecibido = opciones?.plazo?.();
        return { total: 0, actualizados: 0, omitidos: 0, omitidosPorProveedor: 0, pendientes: 0, fallidos: [] };
      },
    };
    const handler = crearHandlerClima({ servicio, log: logSilencioso });
    await handler({ source: "aws.events" }, { getRemainingTimeInMillis: () => 15_000 });
    assert.equal(plazoRecibido, 15_000);
  });

  it("no filtra detalles de errores inesperados (500 genérico)", async () => {
    const servicio = crearServicioFalso({
      obtener: () => {
        throw new Error("AccessDeniedException: arn:aws:dynamodb:...");
      },
    });
    const res = (await crearHandlerClima({ servicio, log: logSilencioso })(eventoJwt("abc"))) as RespuestaHttp;
    assert.equal(res.statusCode, 500);
    assert.doesNotMatch(res.body, /arn:aws/);
  });

  it("ante un evento de EventBridge ejecuta el refresco masivo", async () => {
    const resumen: ResumenRefresco = { total: 2, actualizados: 2, omitidos: 0, omitidosPorProveedor: 0, pendientes: 0, fallidos: [] };
    const servicio = crearServicioFalso({ refrescar: () => resumen });
    const res = await crearHandlerClima({ servicio, log: logSilencioso })({
      source: "aws.events",
      "detail-type": "Scheduled Event",
    });
    assert.deepEqual(res, resumen);
  });
});
