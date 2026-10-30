import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { crearServicioClima } from "../../src/application/clima/servicioClima";
import { sumarDias } from "../../src/domain/clima/reglas";
import { ErrorServicioExterno, ErrorValidacion } from "../../src/domain/clima/tipos";
import type { DiaClimaGuardado, DiaPronostico, Ubicacion } from "../../src/domain/clima/tipos";
import type { ClimaRepositorioPort, ConfiguracionClima } from "../../src/ports/clima";

const ZONA = "America/Argentina/Buenos_Aires";
// 18/10/2026 23:30 en Argentina = 19/10/2026 02:30 UTC → el "hoy" local debe ser el 18.
const AHORA = new Date("2026-10-19T02:30:00Z");
const DIAS = 3;

const logSilencioso = { info() {}, warn() {}, error() {} };

function diasPronostico(desde = "2026-10-18"): DiaPronostico[] {
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

function enCache(usuarioID: string, actualizadoEn: string, dias = diasPronostico()): DiaClimaGuardado[] {
  return dias.map((d) => ({ usuarioID, ...d, actualizadoEn, expiraEn: 0 }));
}

interface RepoFalso extends ClimaRepositorioPort {
  guardados: DiaClimaGuardado[];
  consultas: Array<{ usuarioID: string; desde: string; hasta: string }>;
}

function crearRepoFalso({
  configuraciones = {},
  cache = [],
}: { configuraciones?: Record<string, ConfiguracionClima>; cache?: DiaClimaGuardado[] } = {}): RepoFalso {
  const repo: RepoFalso = {
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

function crearServicio({
  repo,
  pronostico = async () => diasPronostico(),
  ubicacionPorDefecto = null,
}: {
  repo: RepoFalso;
  pronostico?: (ubicacion: Ubicacion) => Promise<DiaPronostico[]>;
  ubicacionPorDefecto?: Ubicacion | null;
}) {
  let llamadasApi = 0;
  const servicio = crearServicioClima({
    repositorio: repo,
    pronostico: {
      async obtenerPronostico(ubicacion) {
        llamadasApi++;
        return pronostico(ubicacion);
      },
    },
    config: { cacheHoras: 6, diasPronostico: DIAS, ttlDias: 14, zonaHoraria: ZONA, ubicacionPorDefecto },
    ahora: () => AHORA,
    log: logSilencioso,
  });
  return { servicio, llamadasApi: () => llamadasApi };
}

const CONFIG_LA_PLATA = {
  u1: { usuarioID: "u1", ubicacion: { ciudad: "La Plata", lat: "-34.92", lon: "-57.95" } },
};
const horasAntes = (h: number) => new Date(AHORA.getTime() - h * 60 * 60 * 1000).toISOString();

describe("obtenerClimaUsuario", () => {
  it("sin cache: consulta el pronóstico, persiste con TTL y devuelve la vista pública", async () => {
    const repo = crearRepoFalso({ configuraciones: CONFIG_LA_PLATA });
    const { servicio, llamadasApi } = crearServicio({ repo });

    const res = await servicio.obtenerClimaUsuario("u1");

    assert.equal(llamadasApi(), 1);
    assert.equal(res.origen, "open-meteo");
    assert.equal(res.dias.length, DIAS);
    assert.deepEqual(repo.consultas[0], { usuarioID: "u1", desde: "2026-10-18", hasta: "2026-10-20" });

    const guardado = repo.guardados[0]!;
    assert.equal(guardado.usuarioID, "u1");
    assert.equal(guardado.actualizadoEn, AHORA.toISOString());
    assert.equal(guardado.expiraEn, Math.floor(AHORA.getTime() / 1000) + 14 * 86_400);
    // La respuesta no expone atributos internos.
    assert.equal("usuarioID" in res.dias[0]!, false);
    assert.equal("expiraEn" in res.dias[0]!, false);
  });

  it("con cache vigente y completa: no llama a la API", async () => {
    const repo = crearRepoFalso({ configuraciones: CONFIG_LA_PLATA, cache: enCache("u1", horasAntes(1)) });
    const { servicio, llamadasApi } = crearServicio({ repo });

    const res = await servicio.obtenerClimaUsuario("u1");

    assert.equal(llamadasApi(), 0);
    assert.equal(res.origen, "cache");
    assert.equal(res.desactualizado, false);
  });

  it("con cache vencida: refresca desde la API", async () => {
    const repo = crearRepoFalso({ configuraciones: CONFIG_LA_PLATA, cache: enCache("u1", horasAntes(7)) });
    const { servicio, llamadasApi } = crearServicio({ repo });

    const res = await servicio.obtenerClimaUsuario("u1");

    assert.equal(llamadasApi(), 1);
    assert.equal(res.origen, "open-meteo");
  });

  it("con cache incompleta: refresca desde la API", async () => {
    const cache = enCache("u1", AHORA.toISOString(), diasPronostico().slice(0, 1));
    const repo = crearRepoFalso({ configuraciones: CONFIG_LA_PLATA, cache });
    const { servicio, llamadasApi } = crearServicio({ repo });

    await servicio.obtenerClimaUsuario("u1");
    assert.equal(llamadasApi(), 1);
  });

  it("si la API falla y hay cache: devuelve cache marcada como desactualizada", async () => {
    const repo = crearRepoFalso({ configuraciones: CONFIG_LA_PLATA, cache: enCache("u1", horasAntes(24)) });
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
    const porDefecto: Ubicacion = { lat: -34.92, lon: -57.95, ciudad: "La Plata" };
    let ubicacionUsada: Ubicacion | undefined;
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
    const repo = crearRepoFalso({
      configuraciones: {
        ...CONFIG_LA_PLATA,
        sinUbicacion: { usuarioID: "sinUbicacion" },
        conFallo: { usuarioID: "conFallo", ubicacion: { lat: 1, lon: 1 } },
      },
      cache: enCache("u1", AHORA.toISOString()), // vigente
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
    assert.equal(res.fallidos[0]!.usuarioID, "conFallo");
  });
});
