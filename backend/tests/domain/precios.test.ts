import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ErrorValidacion } from "../../src/domain/errores";
import {
  aplicarGuardas,
  cantidadEnUnidadBase,
  confianzaMinima,
  confianzaPorEvidencia,
  costoReceta,
  emparejarPorNombre,
  estadoPorVariacion,
  normalizarNombre,
  precioPorMargen,
  precioPorUnidadBase,
  redondearPrecio,
  resumirHistorial,
  similitud,
  validarTicket,
  variacionPct,
} from "../../src/domain/precios/reglas";
import type { PrecioBase } from "../../src/domain/precios/tipos";

describe("unidades y presentaciones", () => {
  it("convierte gramos, mililitros y docenas a la unidad base", () => {
    assert.deepEqual(cantidadEnUnidadBase(500, "g"), { cantidad: 0.5, unidad: "kg" });
    assert.deepEqual(cantidadEnUnidadBase(250, "ml"), { cantidad: 0.25, unidad: "l" });
    assert.deepEqual(cantidadEnUnidadBase(1, "docena"), { cantidad: 12, unidad: "u" });
    assert.equal(cantidadEnUnidadBase(1, "bolsa"), null);
  });

  it("calcula el precio por kg a partir de la presentación de la descripción", () => {
    assert.deepEqual(precioPorUnidadBase({ descripcion: "Harina 000 x 25 kg", precioUnitario: 8200 }), { precio: 328, unidad: "kg" });
    assert.deepEqual(precioPorUnidadBase({ descripcion: "Levadura fresca x 500 g", precioUnitario: 1070 }), { precio: 2140, unidad: "kg" });
    assert.deepEqual(precioPorUnidadBase({ descripcion: "Esencia de vainilla 500 ml", precioUnitario: 1850 }), { precio: 3700, unidad: "l" });
  });

  it("usa la unidad explícita si la descripción no trae presentación, y si no asume unidades", () => {
    assert.deepEqual(precioPorUnidadBase({ descripcion: "Manteca", precioUnitario: 1300, unidad: "kg" }), { precio: 1300, unidad: "kg" });
    assert.deepEqual(precioPorUnidadBase({ descripcion: "Huevos maple", precioUnitario: 4200 }), { precio: 4200, unidad: "u" });
  });
});

describe("nombres de insumos", () => {
  it("normaliza acentos, mayúsculas y presentaciones", () => {
    assert.equal(normalizarNombre("Azúcar común x 50 kg"), "azucar comun");
    assert.equal(normalizarNombre("Harina 000 x 25 kg (Cañuelas)"), "harina 000 canuelas");
  });

  it("empareja aunque el ticket agregue marca o presentación", () => {
    assert.equal(similitud("Harina 000 x 25 kg Cañuelas", "harina 000"), 1);
    assert.deepEqual(emparejarPorNombre("Harina 000 x 25 kg Cañuelas", ["harina 0000", "harina 000", "manteca"]), {
      insumo: "harina 000",
      certeza: "alta",
    });
  });

  it("no empareja insumos distintos", () => {
    assert.equal(emparejarPorNombre("Grasa refinada x 5 kg", ["manteca", "harina 000"]), null);
  });
});

describe("historial", () => {
  const compras = [
    { insumo: "Harina 000 x 25 kg", fecha: "2026-08-01", precioUnitario: 6000 },
    { insumo: "Harina 000 x 25 kg", fecha: "2026-10-01", precioUnitario: 7000 },
    { insumo: "Harina 000 x 50 kg", fecha: "2026-09-01", precioUnitario: 13000 },
    { insumo: "Detergente", fecha: "2026-10-01", precioUnitario: 900 },
  ];

  it("resume por insumo con último precio, promedio y cantidad de compras", () => {
    const resumen = resumirHistorial(compras, ["harina 000"]);
    const harina = resumen.get("harina 000")!;
    assert.equal(harina.compras, 3);
    assert.deepEqual(harina.ultimo, { precio: 280, unidad: "kg", fecha: "2026-10-01" });
    assert.equal(harina.promedio, (240 + 260 + 280) / 3);
    assert.equal(resumen.size, 1, "el detergente no es insumo de ninguna receta");
  });

  it("calcula variaciones porcentuales con un decimal", () => {
    assert.equal(variacionPct(328, 280), 17.1);
    assert.equal(variacionPct(100, null), null);
    assert.equal(variacionPct(100, 0), null);
  });
});

describe("costos y precios", () => {
  const costos = new Map<string, PrecioBase>([
    ["harina 000", { precio: 328, unidad: "kg" }],
    ["manteca", { precio: 1290, unidad: "kg" }],
  ]);

  it("calcula el costo por receta y reporta los insumos faltantes", () => {
    const { costo, faltantes } = costoReceta(
      [
        { insumo: "harina 000", cantidad: 50, unidad: "g" },
        { insumo: "manteca", cantidad: 0.02, unidad: "kg" },
        { insumo: "azucar", cantidad: 10, unidad: "g" },
      ],
      costos
    );
    assert.equal(Math.round(costo * 100) / 100, 16.4 + 25.8);
    assert.deepEqual(faltantes, ["azucar"]);
  });

  it("marca como faltante un insumo con unidad incompatible", () => {
    assert.deepEqual(costoReceta([{ insumo: "manteca", cantidad: 1, unidad: "u" }], costos).faltantes, ["manteca"]);
  });

  it("calcula el precio por margen sobre el precio de venta", () => {
    assert.equal(precioPorMargen(400, 0.6), 1000);
    assert.throws(() => precioPorMargen(400, 1), RangeError);
  });

  it("redondea a $10 debajo de $1.000 y a $50 desde $1.000", () => {
    assert.equal(redondearPrecio(482), 490);
    assert.equal(redondearPrecio(480), 480);
    assert.equal(redondearPrecio(1301), 1350);
    assert.equal(redondearPrecio(1349, "abajo"), 1300);
  });
});

describe("guardas", () => {
  const base = { costoNuevo: 200, precioActual: 500, margenMinimo: 0.3, topeSubaPct: 0.25 };

  it("respeta una propuesta razonable y solo la redondea", () => {
    assert.deepEqual(aplicarGuardas(553, base), { precio: 560, ajustado: false, motivo: null });
  });

  it("recorta una suba mayor al tope", () => {
    assert.deepEqual(aplicarGuardas(900, base), { precio: 620, ajustado: true, motivo: "tope_suba" });
  });

  it("sube hasta el margen mínimo si la propuesta queda por debajo", () => {
    // piso = 200 / 0.7 = 285.7 → 290
    assert.deepEqual(aplicarGuardas(250, base), { precio: 290, ajustado: true, motivo: "margen_minimo" });
  });

  it("si el margen mínimo exige más que el tope, gana el tope (suba gradual)", () => {
    const r = aplicarGuardas(2000, { ...base, costoNuevo: 600 });
    assert.equal(r.precio, 620);
    assert.equal(r.motivo, "tope_suba_bajo_margen_minimo");
  });

  it("reemplaza una propuesta inválida por el piso", () => {
    assert.equal(aplicarGuardas(Number.NaN, base).motivo, "propuesta_invalida");
  });
});

describe("estado y confianza", () => {
  it("considera estable una variación menor al 2 %", () => {
    assert.equal(estadoPorVariacion(1.9), "estable");
    assert.equal(estadoPorVariacion(-3), "ajustar");
  });

  it("baja la confianza sin receta completa o con poco historial", () => {
    assert.equal(confianzaPorEvidencia({ recetaCompleta: false, comprasMinimas: 10, certezaEmparejamiento: "alta" }), "baja");
    assert.equal(confianzaPorEvidencia({ recetaCompleta: true, comprasMinimas: 2, certezaEmparejamiento: "alta" }), "baja");
    assert.equal(confianzaPorEvidencia({ recetaCompleta: true, comprasMinimas: 4, certezaEmparejamiento: "alta" }), "media");
    assert.equal(confianzaPorEvidencia({ recetaCompleta: true, comprasMinimas: 8, certezaEmparejamiento: "media" }), "media");
    assert.equal(confianzaPorEvidencia({ recetaCompleta: true, comprasMinimas: 8, certezaEmparejamiento: "alta" }), "alta");
  });

  it("toma la confianza mínima", () => {
    assert.equal(confianzaMinima("alta", "media", null), "media");
    assert.equal(confianzaMinima(), "baja");
  });
});

describe("validación del ticket", () => {
  it("normaliza un ticket válido", () => {
    const t = validarTicket({ proveedor: "Molino", items: [{ descripcion: " Harina 000 x 25 kg ", cantidad: "4", precioUnitario: 8200 }] });
    assert.deepEqual(t.items[0], { descripcion: "Harina 000 x 25 kg", cantidad: 4, precioUnitario: 8200, unidad: null });
    assert.equal(t.proveedor, "Molino");
  });

  it("rechaza tickets vacíos o con ítems inválidos", () => {
    assert.throws(() => validarTicket(null), ErrorValidacion);
    assert.throws(() => validarTicket({ items: [] }), ErrorValidacion);
    assert.throws(() => validarTicket({ items: [{ descripcion: "Harina", cantidad: 1, precioUnitario: -5 }] }), /ítem 1/);
  });
});
