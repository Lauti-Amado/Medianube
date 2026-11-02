import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { esThrottling, plazoDe, respuestaError } from "../../src/adapters/in/http";
import { registrarCaida } from "../../src/application/dependencias";
import { ErrorServicioExterno, motivoDe } from "../../src/domain/errores";

function logEnMemoria() {
  const lineas: Array<{ nivel: string; datos: Record<string, unknown> }> = [];
  const anotar = (nivel: string) => (m: string) => lineas.push({ nivel, datos: JSON.parse(m) });
  return { lineas, log: { info: anotar("info"), warn: anotar("warn"), error: anotar("error") } };
}

const errorConNombre = (name: string) => Object.assign(new Error("x"), { name });

describe("respuestaError", () => {
  it("un error inesperado da 500 JSON con requestId y lo loguea con stack", () => {
    const { lineas, log } = logEnMemoria();
    const r = respuestaError(new Error("boom"), { requestId: "req-1", usuarioID: "u", operacion: "op", log });
    assert.equal(r.statusCode, 500);
    assert.deepEqual(JSON.parse(r.body), { error: "Error interno del servidor.", requestId: "req-1" });
    assert.equal(lineas[0]!.nivel, "error");
    assert.equal(lineas[0]!.datos.requestId, "req-1");
    assert.ok(String(lineas[0]!.datos.stack).includes("boom"));
  });

  it("el throttling de DynamoDB da 503 con Retry-After", () => {
    const { log } = logEnMemoria();
    const r = respuestaError(errorConNombre("ProvisionedThroughputExceededException"), { operacion: "op", log });
    assert.equal(r.statusCode, 503);
    assert.equal(r.headers["Retry-After"], "2");
    assert.equal(JSON.parse(r.body).requestId, null);
  });

  it("detecta los nombres de throttling de AWS", () => {
    assert.equal(esThrottling(errorConNombre("ThrottlingException")), true);
    assert.equal(esThrottling(new Error("otro")), false);
    assert.equal(esThrottling("texto"), false);
  });
});

describe("plazoDe", () => {
  it("expone el tiempo restante del contexto y undefined si no hay contexto", () => {
    const plazo = plazoDe({ getRemainingTimeInMillis: () => 1234 });
    assert.equal(plazo?.(), 1234);
    assert.equal(plazoDe(undefined), undefined);
    assert.equal(plazoDe({}), undefined);
  });
});

describe("registro de caídas", () => {
  it("loguea evento, servicio, motivo y consecuencia en una línea JSON", () => {
    const { lineas, log } = logEnMemoria();
    registrarCaida(log, {
      servicio: "claude",
      error: new ErrorServicioExterno("timeout", { motivo: "timeout", servicio: "claude" }),
      usuarioID: "u",
      consecuencia: "se usan reglas",
    });
    assert.deepEqual(lineas[0], {
      nivel: "warn",
      datos: { evento: "dependencia_caida", servicio: "claude", motivo: "timeout", usuarioID: "u", consecuencia: "se usan reglas", error: "timeout" },
    });
  });

  it("un error genérico cuenta como no disponible", () => {
    assert.equal(motivoDe(new Error("x")), "no_disponible");
    assert.equal(new ErrorServicioExterno("x").motivo, "no_disponible");
  });
});
