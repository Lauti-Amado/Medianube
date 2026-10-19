import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { construirUrl, normalizarPronostico, obtenerPronostico } from "../functions/obtenerClima/openMeteo.mjs";
import { describirCodigoClima } from "../functions/obtenerClima/weatherCodes.mjs";

const RESPUESTA_OPEN_METEO = {
  daily: {
    time: ["2026-10-18", "2026-10-19"],
    temperature_2m_max: [24.1, 19.3],
    temperature_2m_min: [12.4, 10.0],
    precipitation_sum: [0, 12.5],
    precipitation_probability_max: [5, 90],
    weather_code: [1, 63],
  },
};

describe("openMeteo", () => {
  it("construye la URL con coordenadas, variables diarias y zona horaria", () => {
    const url = new URL(construirUrl({ lat: -34.92, lon: -57.95 }));
    assert.equal(url.origin + url.pathname, "https://api.open-meteo.com/v1/forecast");
    assert.equal(url.searchParams.get("latitude"), "-34.92");
    assert.equal(url.searchParams.get("longitude"), "-57.95");
    assert.equal(url.searchParams.get("forecast_days"), "7");
    assert.equal(url.searchParams.get("timezone"), "America/Argentina/Buenos_Aires");
    assert.match(url.searchParams.get("daily"), /weather_code/);
  });

  it("normaliza la respuesta columnar a una lista de días", () => {
    const dias = normalizarPronostico(RESPUESTA_OPEN_METEO);
    assert.equal(dias.length, 2);
    assert.deepEqual(dias[1], {
      fecha: "2026-10-19",
      tempMax: 19.3,
      tempMin: 10.0,
      precipitacionMm: 12.5,
      probLluvia: 90,
      codigoClima: 63,
      descripcion: "Lluvia moderada",
    });
  });

  it("rechaza respuestas sin bloque daily", () => {
    assert.throws(() => normalizarPronostico({}), /daily/);
  });

  it("propaga errores HTTP de la API", async () => {
    const fetchFn = async () => ({ ok: false, status: 429 });
    await assert.rejects(obtenerPronostico({ lat: 0, lon: 0 }, { fetchFn }), /HTTP 429/);
  });

  it("devuelve el pronóstico normalizado ante HTTP 200", async () => {
    const fetchFn = async () => ({ ok: true, json: async () => RESPUESTA_OPEN_METEO });
    const dias = await obtenerPronostico({ lat: 0, lon: 0 }, { fetchFn });
    assert.equal(dias[0].descripcion, "Mayormente despejado");
  });

  it("describe códigos WMO desconocidos sin romper", () => {
    assert.equal(describirCodigoClima(999), "Desconocido");
    assert.equal(describirCodigoClima(null), "Desconocido");
  });
});
