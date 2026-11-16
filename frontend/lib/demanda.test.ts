import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { agruparPorDia, isoLocal, resumenSemana, type DiaDemanda, type ProductoApi } from "./demanda";

const producto = (productoID: string, cantidad: number, fecha?: string): ProductoApi => ({
  productoID,
  nombre: productoID,
  cantidad,
  fecha,
});

const dia = (fecha: string, total: number): DiaDemanda => ({ fecha, total, items: [] });

describe("agruparPorDia", () => {
  it("agrupa por fecha, ordena los días y suma la producción de cada uno", () => {
    const dias = agruparPorDia([
      producto("pan", 30, "2026-11-17"),
      producto("medialuna", 150, "2026-11-17"),
      producto("pan", 20, "2026-11-16"),
      producto("sin-fecha", 99),
    ]);
    assert.deepEqual(
      dias.map((d) => ({ fecha: d.fecha, total: d.total })),
      [
        { fecha: "2026-11-16", total: 20 },
        { fecha: "2026-11-17", total: 180 },
      ]
    );
    assert.equal(dias[1]!.items[0]!.productoID, "medialuna");
  });
});

describe("resumenSemana", () => {
  it("calcula total, promedio, pico y cuánto supera el pico al promedio", () => {
    const resumen = resumenSemana([dia("2026-11-16", 100), dia("2026-11-17", 200), dia("2026-11-18", 300)]);
    assert.equal(resumen.total, 600);
    assert.equal(resumen.promedio, 200);
    assert.equal(resumen.pico?.total, 300);
    assert.equal(resumen.picoPct, 50);
  });

  it("sin días no hay pico", () => {
    assert.deepEqual(resumenSemana([]), { total: 0, promedio: 0, pico: null, picoPct: 0 });
  });

  it("con todo en 0 el porcentaje del pico es 0, no NaN", () => {
    assert.equal(resumenSemana([dia("2026-11-16", 0), dia("2026-11-17", 0)]).picoPct, 0);
  });
});

describe("isoLocal", () => {
  it("formatea la fecha local como AAAA-MM-DD", () => {
    assert.equal(isoLocal(new Date(2026, 10, 5)), "2026-11-05");
  });
});
