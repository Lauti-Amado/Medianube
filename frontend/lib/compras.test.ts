import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { calcularResumen, leerGastos, mapInvoices, recientes, type Invoice } from "./compras";

const factura = (date: string, total: number, status: Invoice["status"] = "procesada"): Invoice => ({
  id: `${date}-${total}`,
  provider: "Proveedor",
  date,
  items: 1,
  itemsDetail: "insumos varios",
  itemList: [],
  total,
  status,
});

describe("mapInvoices", () => {
  it("mapea un gasto completo de la API", () => {
    const [inv] = mapInvoices([
      {
        gastoID: "g1",
        proveedor: "Molino",
        fecha: "2026-11-10",
        monto: "84200",
        estado: "revisar",
        items: [{ descripcion: "Harina", cantidad: "2", precio_unitario: 100 }],
      },
    ]);
    assert.equal(inv!.id, "g1");
    assert.equal(inv!.provider, "Molino");
    assert.equal(inv!.date, "2026-11-10");
    assert.equal(inv!.total, 84200);
    assert.equal(inv!.status, "revisar");
    assert.equal(inv!.items, 1);
    assert.deepEqual(inv!.itemList[0], { description: "Harina", quantity: 2, unitPrice: 100 });
  });

  it("completa los campos que faltan", () => {
    const [inv] = mapInvoices([{}]);
    assert.equal(inv!.id, "temp-id-0");
    assert.equal(inv!.provider, "Proveedor desconocido");
    assert.equal(inv!.date, "");
    assert.equal(inv!.total, 0);
    assert.equal(inv!.status, "procesada");
    assert.equal(inv!.items, 1);
    assert.equal(inv!.itemsDetail, "insumos varios");
  });
});

describe("calcularResumen", () => {
  const hoy = new Date(2026, 10, 16);

  it("suma el mes, cuenta las facturas por revisar y compara con el mes anterior", () => {
    const resumen = calcularResumen(
      [factura("2026-11-10", 1000, "revisar"), factura("2026-11-02", 500), factura("2026-10-20", 750)],
      hoy
    );
    assert.deepEqual(resumen, { totalMes: 1500, facturasMes: 2, variacion: 100, porRevisar: 1 });
  });

  it("no compara si el mes anterior no tiene facturas", () => {
    assert.equal(calcularResumen([factura("2026-11-10", 1000)], hoy).variacion, null);
  });
});

describe("leerGastos", () => {
  const gasto = { gastoID: "a" };

  it("acepta { gastos: [...] } o un array", () => {
    assert.deepEqual(leerGastos({ gastos: [gasto] }), [gasto]);
    assert.deepEqual(leerGastos([gasto]), [gasto]);
  });

  it("devuelve una lista vacía con cualquier otra respuesta", () => {
    assert.deepEqual(leerGastos(null), []);
    assert.deepEqual(leerGastos({}), []);
    assert.deepEqual(leerGastos("x"), []);
  });
});

describe("recientes", () => {
  const facturas = [factura("2026-11-01", 1), factura("", 2), factura("2026-11-12", 3), factura("2026-11-05", 4)];

  it("ordena por fecha descendente y toma las primeras n", () => {
    assert.deepEqual(
      recientes(facturas, 3).map((f) => f.date),
      ["2026-11-12", "2026-11-05", "2026-11-01"]
    );
  });

  it("deja al final las facturas sin fecha y no cambia el orden de la entrada", () => {
    assert.deepEqual(
      recientes(facturas, 4).map((f) => f.date),
      ["2026-11-12", "2026-11-05", "2026-11-01", ""]
    );
    assert.deepEqual(
      facturas.map((f) => f.date),
      ["2026-11-01", "", "2026-11-12", "2026-11-05"]
    );
  });
});
