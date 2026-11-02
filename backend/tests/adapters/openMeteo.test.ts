import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { construirUrl, crearPronosticoOpenMeteo, normalizarPronostico } from "../../src/adapters/out/openMeteo";
import { ErrorServicioExterno } from "../../src/domain/errores";

/** fetch falso que responde en orden con las respuestas dadas (o lanza si es un Error) y cuenta llamadas. */
function fetchSecuencia(...respuestas: unknown[]) {
  let llamadas = 0;
  const fetchFn = (async () => {
    const r = respuestas[Math.min(llamadas++, respuestas.length - 1)];
    if (r instanceof Error) throw r;
    return r;
  }) as unknown as typeof fetch;
  return { fetchFn, llamadas: () => llamadas };
}

const ok = (cuerpo: unknown = RESPUESTA_OPEN_METEO) => ({ ok: true, status: 200, json: async () => cuerpo });
const http = (status: number) => ({ ok: false, status });

async function motivoDeFalla(promesa: Promise<unknown>): Promise<string> {
  try {
    await promesa;
  } catch (error) {
    assert.ok(error instanceof ErrorServicioExterno, `se esperaba ErrorServicioExterno y vino ${error}`);
    assert.equal(error.servicio, "open-meteo");
    return error.motivo;
  }
  assert.fail("no falló");
}

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

const UBICACION = { lat: 0, lon: 0, ciudad: null };

describe("adaptador Open-Meteo", () => {
  it("construye la URL con coordenadas, variables diarias y zona horaria", () => {
    const url = new URL(construirUrl({ lat: -34.92, lon: -57.95 }));
    assert.equal(url.origin + url.pathname, "https://api.open-meteo.com/v1/forecast");
    assert.equal(url.searchParams.get("latitude"), "-34.92");
    assert.equal(url.searchParams.get("longitude"), "-57.95");
    assert.equal(url.searchParams.get("forecast_days"), "7");
    assert.equal(url.searchParams.get("timezone"), "America/Argentina/Buenos_Aires");
    assert.match(url.searchParams.get("daily") ?? "", /weather_code/);
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

  it("propaga errores HTTP de la API con su motivo", async () => {
    const { fetchFn } = fetchSecuencia(http(429));
    const puerto = crearPronosticoOpenMeteo({ fetchFn, esperaReintentoMs: 0 });
    await assert.rejects(puerto.obtenerPronostico(UBICACION), /HTTP 429/);
    assert.equal(await motivoDeFalla(puerto.obtenerPronostico(UBICACION)), "limite");
  });

  it("devuelve el pronóstico normalizado ante HTTP 200", async () => {
    const fetchFn = (async () => ({ ok: true, json: async () => RESPUESTA_OPEN_METEO })) as unknown as typeof fetch;
    const puerto = crearPronosticoOpenMeteo({ fetchFn });
    const dias = await puerto.obtenerPronostico(UBICACION);
    assert.equal(dias[0]!.descripcion, "Mayormente despejado");
  });

  it("reintenta un 503 y devuelve el pronóstico si el segundo intento responde", async () => {
    const { fetchFn, llamadas } = fetchSecuencia(http(503), ok());
    const dias = await crearPronosticoOpenMeteo({ fetchFn, esperaReintentoMs: 0 }).obtenerPronostico(UBICACION);
    assert.equal(dias.length, 2);
    assert.equal(llamadas(), 2);
  });

  it("reintenta errores de red y, si siguen, falla como no_disponible", async () => {
    const { fetchFn, llamadas } = fetchSecuencia(new TypeError("fetch failed"));
    const puerto = crearPronosticoOpenMeteo({ fetchFn, esperaReintentoMs: 0 });
    assert.equal(await motivoDeFalla(puerto.obtenerPronostico(UBICACION)), "no_disponible");
    assert.equal(llamadas(), 2);
  });

  it("no reintenta un 400 (no mejora reintentando)", async () => {
    const { fetchFn, llamadas } = fetchSecuencia(http(400));
    const puerto = crearPronosticoOpenMeteo({ fetchFn, esperaReintentoMs: 0 });
    assert.equal(await motivoDeFalla(puerto.obtenerPronostico(UBICACION)), "respuesta_invalida");
    assert.equal(llamadas(), 1);
  });

  it("corta por timeout un fetch que nunca responde", async () => {
    // Respeta la señal de aborto como el fetch real. El timer mantiene vivo el event loop, como lo haría
    // una conexión abierta (el timer de AbortSignal.timeout no lo hace).
    const fetchFn = ((_url: string, init?: RequestInit) =>
      new Promise((_, rechazar) => {
        const conexion = setTimeout(() => {}, 5000);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(conexion);
          rechazar(init.signal!.reason);
        });
      })) as unknown as typeof fetch;
    const puerto = crearPronosticoOpenMeteo({ fetchFn, timeoutMs: 20, reintentos: 0 });
    const inicio = Date.now();
    assert.equal(await motivoDeFalla(puerto.obtenerPronostico(UBICACION)), "timeout");
    assert.ok(Date.now() - inicio < 1000);
  });

  it("un 200 sin días o con JSON roto es una respuesta inválida (sin reintentar)", async () => {
    const vacio = fetchSecuencia(ok({ daily: { time: [] } }));
    assert.equal(await motivoDeFalla(crearPronosticoOpenMeteo({ fetchFn: vacio.fetchFn }).obtenerPronostico(UBICACION)), "respuesta_invalida");
    assert.equal(vacio.llamadas(), 1);

    const fechas = fetchSecuencia(ok({ daily: { time: ["ayer"] } }));
    assert.equal(await motivoDeFalla(crearPronosticoOpenMeteo({ fetchFn: fechas.fetchFn }).obtenerPronostico(UBICACION)), "respuesta_invalida");

    const roto = fetchSecuencia({ ok: true, status: 200, json: async () => JSON.parse("{no es json") });
    assert.equal(await motivoDeFalla(crearPronosticoOpenMeteo({ fetchFn: roto.fetchFn }).obtenerPronostico(UBICACION)), "respuesta_invalida");
  });
});
