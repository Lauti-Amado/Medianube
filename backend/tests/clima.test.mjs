import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  crearServicioClima,
  ErrorServicioExterno,
  ErrorValidacion,
  fechaLocal,
  parsearUbicacion,
  sumarDias,
} from "../functions/obtenerClima/clima.mjs";

const ZONA = "America/Argentina/Buenos_Aires";
// 18/10/2026 23:30 en Argentina = 19/10/2026 02:30 UTC → el "hoy" local debe ser el 18.
const AHORA = new Date("2026-10-19T02:30:00Z");
const DIAS = 3;

const logSilencioso = { info() {}, warn() {}, error() {} };

function diasPronostico(desde = "2026-10-18") {
  return Array.from({ length: DIAS }, (_, i) => ({
    fecha: sumarDias(desde, i),
    tempMax: 20 + i,
    tempMin: 10 + i,
    precipitacionMm: 0,
    probLluvia: 10,
    codigoClima: 1,
    descripcion: "Mayormente despejado",
  }));
}

function crearRepoFalso({ configuraciones = {}, cache = [] } = {}) {
  const repo = {
    guardados: [],
    consultas: [],
    async obtenerConfiguracion(usuarioID) {
      return configuraciones[usuarioID] ?? null;
    },
    async consultarClima(usuarioID, desde, hasta) {
      repo.consultas.push({ usuarioID, desde, hasta });
      return cache.filter((c) => c.usuarioID === usuarioID && c.fecha >= desde && c.fecha <= hasta);
    },
    async guardarClima(items) {
      repo.guardados.push(...items);
    },
    async listarUsuarios() {
      return Object.keys(configuraciones);
    },
  };
  return repo;
}

function crearServicio({ repo, pronostico = async () => diasPronostico(), ubicacionPorDefecto = null }) {
  let llamadasApi = 0;
  const servicio = crearServicioClima({
    repositorio: repo,
    obtenerPronostico: async (ubicacion) => {
      llamadasApi++;
      return pronostico(ubicacion);
    },
    config: { cacheHoras: 6, diasPronostico: DIAS, ttlDias: 14, zonaHoraria: ZONA, ubicacionPorDefecto },
    ahora: () => AHORA,
    log: logSilencioso,
  });
  return { servicio, llamadasApi: () => llamadasApi };
}

const CONFIG_LA_PLATA = { u1: { usuarioID: "u1", ubicacion: { ciudad: "La Plata", lat: "-34.92", lon: "-57.95" } } };

describe("utilidades de fecha y ubicación", () => {
  it("calcula la fecha local en Argentina aunque en UTC ya sea el día siguiente", () => {
    assert.equal(fechaLocal(AHORA, ZONA), "2026-10-18");
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
});

describe("obtenerClimaUsuario", () => {
  it("sin cache: consulta Open-Meteo, persiste con TTL y devuelve la vista pública", async () => {
    const repo = crearRepoFalso({ configuraciones: CONFIG_LA_PLATA });
    const { servicio, llamadasApi } = crearServicio({ repo });

    const res = await servicio.obtenerClimaUsuario("u1");

    assert.equal(llamadasApi(), 1);
    assert.equal(res.origen, "open-meteo");
    assert.equal(res.dias.length, DIAS);
    assert.deepEqual(repo.consultas[0], { usuarioID: "u1", desde: "2026-10-18", hasta: "2026-10-20" });

    const guardado = repo.guardados[0];
    assert.equal(guardado.usuarioID, "u1");
    assert.equal(guardado.actualizadoEn, AHORA.toISOString());
    assert.equal(guardado.expiraEn, Math.floor(AHORA.getTime() / 1000) + 14 * 86_400);
    // La respuesta no expone atributos internos.
    assert.equal(res.dias[0].usuarioID, undefined);
    assert.equal(res.dias[0].expiraEn, undefined);
  });

  it("con cache vigente y completa: no llama a la API", async () => {
    const actualizadoEn = new Date(AHORA.getTime() - 60 * 60 * 1000).toISOString(); // hace 1 h
    const cache = diasPronostico().map((d) => ({ usuarioID: "u1", ...d, actualizadoEn }));
    const repo = crearRepoFalso({ configuraciones: CONFIG_LA_PLATA, cache });
    const { servicio, llamadasApi } = crearServicio({ repo });

    const res = await servicio.obtenerClimaUsuario("u1");

    assert.equal(llamadasApi(), 0);
    assert.equal(res.origen, "cache");
    assert.equal(res.desactualizado, false);
  });

  it("con cache vencida: refresca desde la API", async () => {
    const actualizadoEn = new Date(AHORA.getTime() - 7 * 60 * 60 * 1000).toISOString(); // hace 7 h
    const cache = diasPronostico().map((d) => ({ usuarioID: "u1", ...d, actualizadoEn }));
    const repo = crearRepoFalso({ configuraciones: CONFIG_LA_PLATA, cache });
    const { servicio, llamadasApi } = crearServicio({ repo });

    const res = await servicio.obtenerClimaUsuario("u1");

    assert.equal(llamadasApi(), 1);
    assert.equal(res.origen, "open-meteo");
  });

  it("con cache incompleta: refresca desde la API", async () => {
    const actualizadoEn = AHORA.toISOString();
    const cache = diasPronostico().slice(0, 1).map((d) => ({ usuarioID: "u1", ...d, actualizadoEn }));
    const repo = crearRepoFalso({ configuraciones: CONFIG_LA_PLATA, cache });
    const { servicio, llamadasApi } = crearServicio({ repo });

    await servicio.obtenerClimaUsuario("u1");
    assert.equal(llamadasApi(), 1);
  });

  it("si la API falla y hay cache: devuelve cache marcada como desactualizada", async () => {
    const actualizadoEn = new Date(AHORA.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const cache = diasPronostico().map((d) => ({ usuarioID: "u1", ...d, actualizadoEn }));
    const repo = crearRepoFalso({ configuraciones: CONFIG_LA_PLATA, cache });
    const { servicio } = crearServicio({
      repo,
      pronostico: async () => {
        throw new Error("timeout");
      },
    });

    const res = await servicio.obtenerClimaUsuario("u1");
    assert.equal(res.origen, "cache");
    assert.equal(res.desactualizado, true);
    assert.equal(repo.guardados.length, 0);
  });

  it("si la API falla y no hay cache: lanza ErrorServicioExterno", async () => {
    const repo = crearRepoFalso({ configuraciones: CONFIG_LA_PLATA });
    const { servicio } = crearServicio({
      repo,
      pronostico: async () => {
        throw new Error("timeout");
      },
    });
    await assert.rejects(servicio.obtenerClimaUsuario("u1"), ErrorServicioExterno);
  });

  it("si falla la escritura en DynamoDB igual devuelve el pronóstico", async () => {
    const repo = crearRepoFalso({ configuraciones: CONFIG_LA_PLATA });
    repo.guardarClima = async () => {
      throw new Error("ProvisionedThroughputExceeded");
    };
    const { servicio } = crearServicio({ repo });

    const res = await servicio.obtenerClimaUsuario("u1");
    assert.equal(res.origen, "open-meteo");
  });

  it("sin ubicación configurada ni ubicación por defecto: ErrorValidacion", async () => {
    const repo = crearRepoFalso({ configuraciones: { u2: { usuarioID: "u2" } } });
    const { servicio } = crearServicio({ repo });
    await assert.rejects(servicio.obtenerClimaUsuario("u2"), ErrorValidacion);
  });

  it("sin ubicación configurada: usa la ubicación por defecto y lo informa", async () => {
    const repo = crearRepoFalso();
    const porDefecto = { lat: -34.92, lon: -57.95, ciudad: "La Plata" };
    let ubicacionUsada;
    const { servicio } = crearServicio({
      repo,
      ubicacionPorDefecto: porDefecto,
      pronostico: async (ubicacion) => {
        ubicacionUsada = ubicacion;
        return diasPronostico();
      },
    });

    const res = await servicio.obtenerClimaUsuario("nuevo");
    assert.equal(res.ubicacionPorDefecto, true);
    assert.deepEqual(ubicacionUsada, porDefecto);
  });
});

describe("refrescarTodos", () => {
  it("fuerza el refresco, omite usuarios sin ubicación y registra fallos", async () => {
    const actualizadoEn = AHORA.toISOString();
    const cache = diasPronostico().map((d) => ({ usuarioID: "u1", ...d, actualizadoEn })); // vigente
    const repo = crearRepoFalso({
      configuraciones: {
        ...CONFIG_LA_PLATA,
        sinUbicacion: { usuarioID: "sinUbicacion" },
        conFallo: { usuarioID: "conFallo", ubicacion: { lat: 1, lon: 1 } },
      },
      cache,
    });
    const { servicio, llamadasApi } = crearServicio({
      repo,
      pronostico: async ({ lat }) => {
        if (lat === 1) throw new Error("caída");
        return diasPronostico();
      },
    });

    const res = await servicio.refrescarTodos();

    assert.equal(llamadasApi(), 2); // u1 se refresca aunque la cache esté vigente
    assert.deepEqual(
      { total: res.total, actualizados: res.actualizados, omitidos: res.omitidos },
      { total: 3, actualizados: 1, omitidos: 1 }
    );
    assert.equal(res.fallidos.length, 1);
    assert.equal(res.fallidos[0].usuarioID, "conFallo");
  });
});
