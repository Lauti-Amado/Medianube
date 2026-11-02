import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { crearHandlerDemanda } from "../../src/adapters/in/lambdaDemanda";
import type { ResultadoDemanda, ResumenCorrida, ServicioDemanda } from "../../src/application/demanda/servicioDemanda";
import { ErrorValidacion } from "../../src/domain/errores";

const logSilencioso = { info() {}, warn() {}, error() {} };

function crearServicioFalso() {
  const llamadas: string[] = [];
  const servicio: ServicioDemanda = {
    async predecirUsuario(usuarioID) {
      llamadas.push(`usuario:${usuarioID}`);
      return { usuarioID, predicciones: 7 } as ResultadoDemanda;
    },
    async predecirTodos() {
      llamadas.push("todos");
      return { total: 2, procesados: 2, sinVentas: 0, predicciones: 14, fallidos: [] } satisfies ResumenCorrida;
    },
  };
  return { servicio, llamadas };
}

const evento = (archivo: string) => JSON.parse(readFileSync(new URL(`../../events/${archivo}`, import.meta.url), "utf8"));

describe("handler de predecirDemanda", () => {
  it("el evento programado de EventBridge predice para todos los usuarios", async () => {
    const { servicio, llamadas } = crearServicioFalso();
    const r = await crearHandlerDemanda({ servicio, log: logSilencioso })(evento("prediccion-programada.json"));
    assert.deepEqual(llamadas, ["todos"]);
    assert.equal((r as ResumenCorrida).predicciones, 14);
  });

  it("una invocación con usuarioID predice solo para ese usuario", async () => {
    const { servicio, llamadas } = crearServicioFalso();
    await crearHandlerDemanda({ servicio, log: logSilencioso })(evento("predecir-usuario-dev.json"));
    assert.deepEqual(llamadas, ["usuario:user_test_123"]);
  });

  it("rechaza eventos desconocidos", async () => {
    const { servicio, llamadas } = crearServicioFalso();
    const handler = crearHandlerDemanda({ servicio, log: logSilencioso });
    await assert.rejects(handler({}), ErrorValidacion);
    await assert.rejects(handler({ usuarioID: 42 }), ErrorValidacion);
    await assert.rejects(handler(null), ErrorValidacion);
    assert.deepEqual(llamadas, []);
  });
});
