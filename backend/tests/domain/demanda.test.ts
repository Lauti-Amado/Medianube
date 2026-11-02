import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sumarDias } from "../../src/domain/clima/reglas";
import {
  backtest,
  baseMismoDia,
  confianzaPorEvidencia,
  diaSemana,
  factorClima,
  pesos,
  precision,
  predecirProducto,
  serieDiaria,
} from "../../src/domain/demanda/modelo";
import { CONFIG_MODELO_DEFECTO as CONFIG } from "../../src/domain/demanda/tipos";
import type { ClimaDia, SerieDiaria, VentaDiaria } from "../../src/domain/demanda/tipos";

// 2026-10-31 es sábado; 2026-11-01, domingo.
const AYER = "2026-10-31";

/** Serie de `dias` días que termina en `hasta`, con un valor por día de la semana. */
function seriePorDia(valores: Record<number, number>, dias = 56, hasta = AYER): SerieDiaria {
  const serie: SerieDiaria = new Map();
  for (let i = dias - 1; i >= 0; i--) {
    const f = sumarDias(hasta, -i);
    serie.set(f, valores[diaSemana(f)] ?? 100);
  }
  return serie;
}

describe("diaSemana", () => {
  it("devuelve el día de la semana de una fecha YYYY-MM-DD", () => {
    assert.equal(diaSemana("2026-10-31"), 6);
    assert.equal(diaSemana("2026-11-01"), 0);
  });
});

describe("serieDiaria", () => {
  const ventas: VentaDiaria[] = [
    { fecha: "2026-10-27", productoID: "p", cantidad: 10 },
    { fecha: "2026-10-27", productoID: "p", cantidad: 5 },
    { fecha: "2026-10-29", productoID: "p", cantidad: 8 },
    { fecha: "2026-09-01", productoID: "p", cantidad: 99 }, // fuera de rango
    { fecha: "2026-10-30", productoID: "p", cantidad: Number.NaN },
  ];

  it("suma por día y completa con ceros desde la primera venta", () => {
    const serie = serieDiaria(ventas, "2026-10-20", "2026-10-31");
    assert.deepEqual([...serie.entries()], [
      ["2026-10-27", 15],
      ["2026-10-28", 0],
      ["2026-10-29", 8],
      ["2026-10-30", 0],
      ["2026-10-31", 0],
    ]);
  });

  it("devuelve una serie vacía si no hay ventas válidas", () => {
    assert.equal(serieDiaria([], "2026-10-01", "2026-10-31").size, 0);
  });
});

describe("baseMismoDia", () => {
  it("con valores constantes devuelve ese valor y dispersión cero", () => {
    const e = baseMismoDia(seriePorDia({ 6: 300 }), "2026-11-07", CONFIG);
    assert.deepEqual(e, { base: 300, observaciones: 8, cv: 0 });
  });

  it("pondera más las semanas recientes", () => {
    // Sábado reciente 200, el anterior 100: el promedio ponderado queda más cerca de 200.
    const serie: SerieDiaria = new Map([
      ["2026-10-24", 100],
      ["2026-10-31", 200],
    ]);
    const e = baseMismoDia(serie, "2026-11-07", CONFIG)!;
    assert.equal(e.observaciones, 2);
    assert.ok(e.base > 150 && e.base < 200, `base ${e.base}`);
    assert.equal(Math.round(e.base * 100) / 100, Math.round(((200 + 100 * 0.8) / 1.8) * 100) / 100);
  });

  it("devuelve null sin observaciones del mismo día", () => {
    assert.equal(baseMismoDia(new Map([["2026-10-30", 50]]), "2026-11-07", CONFIG), null);
  });

  it("no mira más de N semanas atrás", () => {
    const e = baseMismoDia(seriePorDia({}, 140), "2026-11-07", { semanas: 4, decaimiento: 1 })!;
    assert.equal(e.observaciones, 4);
  });
});

describe("pesos", () => {
  it("decae exponencialmente", () => {
    assert.deepEqual(pesos(3, 0.5), [1, 0.5, 0.25]);
  });
});

describe("factorClima", () => {
  const dia = (probLluvia: number | null, precipitacionMm: number | null): ClimaDia => ({
    fecha: "2026-11-01",
    probLluvia,
    precipitacionMm,
  });

  it("aplica el factor de lluvia por probabilidad o por milímetros", () => {
    assert.equal(factorClima(dia(80, 0), CONFIG), 0.85);
    assert.equal(factorClima(dia(10, 5), CONFIG), 0.85);
  });

  it("devuelve 1 si no llueve y null si no hay pronóstico", () => {
    assert.equal(factorClima(dia(20, 0.5), CONFIG), 1);
    assert.equal(factorClima(undefined, CONFIG), null);
    assert.equal(factorClima(dia(null, null), CONFIG), null);
  });
});

describe("confianzaPorEvidencia", () => {
  it("depende de observaciones y dispersión", () => {
    assert.equal(confianzaPorEvidencia(8, 0.1, true), "alta");
    assert.equal(confianzaPorEvidencia(8, 0.3, true), "media");
    assert.equal(confianzaPorEvidencia(4, 0.1, true), "media");
    assert.equal(confianzaPorEvidencia(2, 0, true), "baja");
    assert.equal(confianzaPorEvidencia(8, 0.9, true), "baja");
  });

  it("sin clima baja un nivel", () => {
    assert.equal(confianzaPorEvidencia(8, 0.1, false), "media");
    assert.equal(confianzaPorEvidencia(2, 0.1, false), "baja");
  });
});

describe("backtest y precision", () => {
  it("un patrón semanal estable da precisión 1", () => {
    const serie = seriePorDia({ 0: 50, 6: 300 });
    const r = backtest(serie, AYER, CONFIG);
    assert.equal(r.dias, 7);
    assert.equal(r.error, 0);
    assert.equal(precision(r), 1);
  });

  it("un cambio brusco baja la precisión y la acota a [0, 1]", () => {
    const serie = seriePorDia({});
    serie.set(AYER, 400); // el último sábado se cuadruplicó
    const p = precision(backtest(serie, AYER, CONFIG))!;
    assert.ok(p > 0 && p < 1, `precisión ${p}`);
    assert.equal(precision({ real: 10, error: 50 }), 0);
  });

  it("sin ventas devuelve null", () => {
    assert.equal(precision(backtest(new Map(), AYER, CONFIG)), null);
  });
});

describe("predecirProducto", () => {
  const serie = seriePorDia({ 0: 60, 6: 300 });
  const fechas = Array.from({ length: 7 }, (_, i) => sumarDias("2026-11-01", i)); // dom → sáb

  it("predice cada día futuro con el patrón del mismo día de la semana", () => {
    const clima = new Map(fechas.map((fecha) => [fecha, { fecha, probLluvia: 0, precipitacionMm: 0 }]));
    const p = predecirProducto("medialuna", serie, fechas, clima, CONFIG);
    assert.equal(p.length, 7);
    assert.equal(p[0]!.cantidad, 60); // domingo
    assert.equal(p[6]!.cantidad, 300); // sábado
    assert.ok(p.every((d) => d.confianza === "alta" && d.factorClima === 1 && d.productoID === "medialuna"));
  });

  it("la lluvia baja la cantidad y redondea hacia arriba", () => {
    const clima = new Map([["2026-11-07", { fecha: "2026-11-07", probLluvia: 90, precipitacionMm: 8 }]]);
    const sabado = predecirProducto("medialuna", serie, ["2026-11-07"], clima, CONFIG)[0]!;
    assert.equal(sabado.factorClima, 0.85);
    assert.equal(sabado.cantidad, 255);
    assert.equal(predecirProducto("x", seriePorDia({ 6: 3 }), ["2026-11-07"], clima, CONFIG)[0]!.cantidad, 3); // 2,55 → 3
  });

  it("sin clima usa factor 1 y degrada la confianza", () => {
    const p = predecirProducto("medialuna", serie, ["2026-11-07"], new Map(), CONFIG)[0]!;
    assert.equal(p.factorClima, null);
    assert.equal(p.cantidad, 300);
    assert.equal(p.confianza, "media");
  });

  it("omite los días sin historial del mismo día de la semana", () => {
    const corta = seriePorDia({}, 3); // jue, vie, sáb
    assert.deepEqual(
      predecirProducto("x", corta, fechas, new Map(), CONFIG).map((d) => d.fecha),
      ["2026-11-05", "2026-11-06", "2026-11-07"]
    );
  });
});
