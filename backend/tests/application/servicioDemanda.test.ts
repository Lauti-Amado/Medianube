import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { crearServicioDemanda } from "../../src/application/demanda/servicioDemanda";
import { sumarDias } from "../../src/domain/clima/reglas";
import type { DiaClimaGuardado } from "../../src/domain/clima/tipos";
import { diaSemana } from "../../src/domain/demanda/modelo";
import { CONFIG_MODELO_DEFECTO } from "../../src/domain/demanda/tipos";
import type { VentaDiaria } from "../../src/domain/demanda/tipos";
import { ErrorValidacion } from "../../src/domain/errores";
import type { ClimaLecturaPort, DemandaRepositorioPort, PrediccionGuardada, ProductoCatalogo } from "../../src/ports/demanda";

// 05:30 ART del domingo 01/11/2026 (08:30 UTC): "hoy" es el 1, las ventas llegan hasta el sábado 31.
const AHORA = new Date("2026-11-01T08:30:00Z");
const CONFIG = { zonaHoraria: "America/Argentina/Buenos_Aires", diasPrediccion: 7, ttlDias: 30, modelo: CONFIG_MODELO_DEFECTO };

const logSilencioso = { info() {}, warn() {}, error() {} };

/** 8 semanas de ventas hasta el 31/10: sábados 300, domingos 60, resto 120. */
function ventasDemo(productoID: string, semanas = 8): VentaDiaria[] {
  return Array.from({ length: 7 * semanas }, (_, i) => {
    const fecha = sumarDias("2026-10-31", -i);
    const d = diaSemana(fecha);
    return { fecha, productoID, cantidad: d === 6 ? 300 : d === 0 ? 60 : 120 };
  });
}

function crearRepoFalso({
  ventas = {} as Record<string, VentaDiaria[]>,
  productos = [] as ProductoCatalogo[],
  falla = false,
} = {}) {
  const repo = {
    guardados: [] as PrediccionGuardada[],
    consultas: [] as Array<{ usuarioID: string; desde: string; hasta: string }>,
    async listarVentas(usuarioID: string, desde: string, hasta: string) {
      if (falla) throw new Error("DynamoDB caído");
      repo.consultas.push({ usuarioID, desde, hasta });
      return (ventas[usuarioID] ?? []).filter((v) => v.fecha >= desde && v.fecha <= hasta);
    },
    async listarProductos() {
      return productos;
    },
    async guardarPredicciones(items: PrediccionGuardada[]) {
      repo.guardados.push(...items);
    },
  };
  return repo satisfies DemandaRepositorioPort;
}

function crearClimaFalso({ dias = [] as DiaClimaGuardado[], usuarios = [] as string[], falla = false } = {}): ClimaLecturaPort {
  return {
    async consultarClima() {
      if (falla) throw new Error("tabla de clima no disponible");
      return dias;
    },
    async listarUsuarios() {
      return usuarios;
    },
  };
}

const diaClima = (fecha: string, probLluvia: number): DiaClimaGuardado => ({
  usuarioID: "u1",
  fecha,
  probLluvia,
  precipitacionMm: probLluvia > 50 ? 6 : 0,
  tempMax: 20,
  tempMin: 10,
  codigoClima: 3,
  descripcion: "",
  actualizadoEn: AHORA.toISOString(),
  expiraEn: 0,
});

const semanaSinLluvia = Array.from({ length: 7 }, (_, i) => diaClima(sumarDias("2026-11-01", i), 10));

describe("predecirUsuario", () => {
  it("guarda 7 días por producto con clave fecha#productoID, TTL y versión del modelo", async () => {
    const repo = crearRepoFalso({
      ventas: { u1: [...ventasDemo("medialuna"), ...ventasDemo("pan")] },
      productos: [{ productoID: "medialuna", nombre: "Medialunas (u.)" }],
    });
    const servicio = crearServicioDemanda({
      repositorio: repo,
      clima: crearClimaFalso({ dias: semanaSinLluvia }),
      config: CONFIG,
      ahora: () => AHORA,
      log: logSilencioso,
    });

    const r = await servicio.predecirUsuario("u1");

    assert.equal(r.desde, "2026-11-01");
    assert.equal(r.hasta, "2026-11-07");
    assert.equal(r.productos, 2);
    assert.equal(r.predicciones, 14);
    assert.equal(r.precisionPct, 1);
    assert.equal(r.sinClima, false);
    assert.equal(repo.consultas[0]!.hasta, "2026-10-31"); // no lee ventas de hoy

    const domingo = repo.guardados.find((p) => p.fechaProducto === "2026-11-01#medialuna")!;
    assert.equal(domingo.cantidad, 60);
    assert.equal(domingo.nombre, "Medialunas (u.)");
    assert.equal(domingo.versionModelo, "demanda-v1");
    assert.equal(domingo.confianza, "alta");
    assert.equal(domingo.expiraEn, Math.floor(AHORA.getTime() / 1000) + 30 * 86_400);
    assert.equal(repo.guardados.find((p) => p.fechaProducto === "2026-11-07#pan")!.nombre, "pan"); // sin catálogo
  });

  it("la lluvia pronosticada baja la predicción de ese día", async () => {
    const repo = crearRepoFalso({ ventas: { u1: ventasDemo("medialuna") } });
    const dias = semanaSinLluvia.map((d) => (d.fecha === "2026-11-07" ? diaClima(d.fecha, 90) : d));
    const servicio = crearServicioDemanda({
      repositorio: repo,
      clima: crearClimaFalso({ dias }),
      config: CONFIG,
      ahora: () => AHORA,
      log: logSilencioso,
    });

    await servicio.predecirUsuario("u1");
    const sabado = repo.guardados.find((p) => p.fecha === "2026-11-07")!;
    assert.equal(sabado.factorClima, 0.85);
    assert.equal(sabado.cantidad, 255);
  });

  it("si falla el clima predice igual, sin ajuste y con confianza degradada", async () => {
    const repo = crearRepoFalso({ ventas: { u1: ventasDemo("medialuna") } });
    const servicio = crearServicioDemanda({
      repositorio: repo,
      clima: crearClimaFalso({ falla: true }),
      config: CONFIG,
      ahora: () => AHORA,
      log: logSilencioso,
    });

    const r = await servicio.predecirUsuario("u1");
    assert.equal(r.sinClima, true);
    assert.equal(r.predicciones, 7);
    assert.ok(repo.guardados.every((p) => p.factorClima === null && p.confianza === "media"));
  });

  it("sin ventas no escribe nada", async () => {
    const repo = crearRepoFalso();
    const servicio = crearServicioDemanda({
      repositorio: repo,
      clima: crearClimaFalso(),
      config: CONFIG,
      ahora: () => AHORA,
      log: logSilencioso,
    });

    const r = await servicio.predecirUsuario("u1");
    assert.equal(r.predicciones, 0);
    assert.equal(repo.guardados.length, 0);
  });

  it("rechaza un usuarioID vacío", async () => {
    const servicio = crearServicioDemanda({ repositorio: crearRepoFalso(), clima: crearClimaFalso(), config: CONFIG });
    await assert.rejects(servicio.predecirUsuario(""), ErrorValidacion);
  });
});

describe("predecirTodos", () => {
  it("recorre todos los usuarios y un fallo no corta la corrida", async () => {
    const repo = crearRepoFalso({ ventas: { u1: ventasDemo("medialuna"), u3: ventasDemo("pan") } });
    const listarVentas = repo.listarVentas;
    repo.listarVentas = async (usuarioID, desde, hasta) => {
      if (usuarioID === "u2") throw new Error("throttling");
      return listarVentas(usuarioID, desde, hasta);
    };
    const servicio = crearServicioDemanda({
      repositorio: repo,
      clima: crearClimaFalso({ dias: semanaSinLluvia, usuarios: ["u1", "u2", "u3", "u4"] }),
      config: CONFIG,
      ahora: () => AHORA,
      log: logSilencioso,
    });

    const r = await servicio.predecirTodos();
    assert.deepEqual(r, {
      total: 4,
      procesados: 2,
      sinVentas: 1,
      predicciones: 14,
      fallidos: [{ usuarioID: "u2", error: "throttling" }],
    });
  });
});
