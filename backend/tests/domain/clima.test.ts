import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { describirCodigoClima } from "../../src/domain/clima/codigosClima";
import { fechaLocal, parsearUbicacion, sumarDias } from "../../src/domain/clima/reglas";

const ZONA = "America/Argentina/Buenos_Aires";

describe("dominio de clima", () => {
  it("calcula la fecha local en Argentina aunque en UTC ya sea el día siguiente", () => {
    // 18/10/2026 23:30 en Argentina = 19/10/2026 02:30 UTC
    assert.equal(fechaLocal(new Date("2026-10-19T02:30:00Z"), ZONA), "2026-10-18");
  });

  it("suma días cruzando fin de mes", () => {
    assert.equal(sumarDias("2026-10-30", 3), "2026-11-02");
  });

  it("parsea coordenadas guardadas como string y rechaza valores inválidos", () => {
    assert.deepEqual(parsearUbicacion({ lat: "-34.92", lon: "-57.95", ciudad: "La Plata" }), {
      lat: -34.92,
      lon: -57.95,
      ciudad: "La Plata",
    });
    assert.equal(parsearUbicacion({ lat: "abc", lon: 1 }), null);
    assert.equal(parsearUbicacion({ lat: 100, lon: 1 }), null);
    assert.equal(parsearUbicacion({ lat: "", lon: "" }), null);
    assert.equal(parsearUbicacion(undefined), null);
  });

  it("describe códigos WMO desconocidos sin romper", () => {
    assert.equal(describirCodigoClima(63), "Lluvia moderada");
    assert.equal(describirCodigoClima(999), "Desconocido");
    assert.equal(describirCodigoClima(null), "Desconocido");
  });
});
