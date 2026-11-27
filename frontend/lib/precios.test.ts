import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { esAjusteRecomendado, margen, margenPromedio, normalizarResultadoPrecios, type SugerenciaPrecio } from "./precios";

/** Sugerencia normalizada a partir de los campos que importan en cada caso. */
const sugerencia = (campos: Record<string, unknown>): SugerenciaPrecio =>
  normalizarResultadoPrecios({ success: true, sugerencias: [campos] }).sugerencias[0]!;

describe("normalizarResultadoPrecios", () => {
  it("marca como aplicadas las sugerencias que la API ya aplicó", () => {
    const { sugerencias } = normalizarResultadoPrecios({
      success: true,
      sugerencias: [
        { productoID: "pan", estadoAplicacion: "aplicada" },
        { productoID: "medialuna" },
      ],
    });
    assert.deepEqual(
      sugerencias.map((s) => s.aplicada),
      [true, false]
    );
  });

  it("acepta la respuesta sin sugerencias guardadas", () => {
    const resultado = normalizarResultadoPrecios({ success: true, sugerenciaPrecioID: null, sugerencias: [] });
    assert.equal(resultado.success, true);
    assert.equal(resultado.sugerenciaPrecioID, "");
    assert.deepEqual(resultado.sugerencias, []);
  });

  it("sin fecha de generación no inventa una (la pantalla no muestra 'actualizado')", () => {
    assert.equal(normalizarResultadoPrecios({ success: true, fechaGeneracion: null, sugerencias: [] }).fechaGeneracion, "");
  });
});

describe("margen", () => {
  it("calcula el margen sobre el precio de venta", () => {
    assert.equal(margen(100, 40), 60);
  });

  it("sin precio no hay margen", () => {
    assert.equal(margen(0, 40), null);
  });
});

describe("margenPromedio", () => {
  const a = sugerencia({ productoID: "a", precioActual: 100, costoActual: 40, margenResultante: 60 });
  const b = sugerencia({ productoID: "b", precioActual: 200, costoActual: 150, margenResultante: 60 });

  it("usa el margen resultante de lo aplicado y el actual del resto", () => {
    assert.equal(margenPromedio([a, b], new Set(["b"])), 60);
    assert.equal(margenPromedio([a, b], new Set()), 42.5);
  });

  it("ignora los productos sin precio y devuelve null sin datos", () => {
    const sinPrecio = sugerencia({ productoID: "c", precioActual: 0, costoActual: 10 });
    assert.equal(margenPromedio([a, sinPrecio], new Set()), 60);
    assert.equal(margenPromedio([], new Set()), null);
  });
});

describe("esAjusteRecomendado", () => {
  it("recomienda revisar cambios de precio de 2% o más", () => {
    assert.equal(esAjusteRecomendado(sugerencia({ precioActual: 100, costoActual: 40, variacionPrecio: 5 })), true);
  });

  it("no recomienda revisar un cambio chico sin tope y con precio sobre el costo", () => {
    assert.equal(esAjusteRecomendado(sugerencia({ precioActual: 100, costoActual: 40, variacionPrecio: 1 })), false);
  });

  it("recomienda revisar si el precio está por debajo del costo", () => {
    assert.equal(esAjusteRecomendado(sugerencia({ precioActual: 30, costoActual: 40, variacionPrecio: 1 })), true);
  });
});

describe("origen de la sugerencia", () => {
  it("lee el respaldo por reglas que informa la API", () => {
    const r = normalizarResultadoPrecios({
      success: true,
      origen: "reglas",
      degradado: true,
      motivoDegradacion: "timeout",
      sugerencias: [{ productoID: "pan" }],
    });
    assert.equal(r.origen, "reglas");
    assert.equal(r.degradado, true);
    assert.equal(r.motivoDegradacion, "timeout");
    assert.equal(r.sugerencias[0]!.origen, "reglas");
  });

  it("sin datos de origen asume que la calculó la IA", () => {
    const r = normalizarResultadoPrecios({ success: true, sugerencias: [{ productoID: "pan" }] });
    assert.equal(r.origen, "llm");
    assert.equal(r.degradado, false);
    assert.equal(r.motivoDegradacion, null);
    assert.equal(r.sugerencias[0]!.origen, "llm");
  });
});
