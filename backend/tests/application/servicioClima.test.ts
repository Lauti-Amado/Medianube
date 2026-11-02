import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { crearServicioClima } from "../../src/application/clima/servicioClima";
import { sumarDias } from "../../src/domain/clima/reglas";
import { AVISO_DESACTUALIZADO, AVISO_SIN_DATOS } from "../../src/application/clima/servicioClima";
import { ErrorServicioExterno, ErrorValidacion } from "../../src/domain/clima/tipos";
import type { DiaClimaGuardado, DiaPronostico, Ubicacion } from "../../src/domain/clima/tipos";
import type { ClimaRepositorioPort, ConfiguracionClima } from "../../src/ports/clima";
import type { LoggerPort } from "../../src/ports/logger";

const ZONA = "America/Argentina/Buenos_Aires";
// 18/10/2026 23:30 en Argentina = 19/10/2026 02:30 UTC → el "hoy" local debe ser el 18.
const AHORA = new Date("2026-10-19T02:30:00Z");
const DIAS = 3;

const logSilencioso = { info() {}, warn() {}, error() {} };
const caida = () => new ErrorServicioExterno("Open-Meteo no respondió", { motivo: "timeout", servicio: "open-meteo" });

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
  log = logSilencioso,
}: {
  repo: RepoFalso;
  pronostico?: (ubicacion: Ubicacion) => Promise<DiaPronostico[]>;
  ubicacionPorDefecto?: Ubicacion | null;
  log?: LoggerPort;
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
    log,
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
    assert.equal(res.disponible, true);
    assert.equal(res.desactualizado, true);
    assert.equal(res.aviso, AVISO_DESACTUALIZADO);
    assert.equal(repo.guardados.length, 0);
  });

  it("si la API falla y no hay cache: responde degradado sin lanzar y registra la caída", async () => {
    const repo = crearRepoFalso({ configuraciones: CONFIG_LA_PLATA });
    const avisos: string[] = [];
    const { servicio } = crearServicio({
      repo,
      pronostico: async () => {
        throw caida();
      },
      log: { ...logSilencioso, warn: (m: string) => void avisos.push(m) },
    });

    const res = await servicio.obtenerClimaUsuario("u1");
    assert.deepEqual(
      { origen: res.origen, disponible: res.disponible, desactualizado: res.desactualizado, aviso: res.aviso, dias: res.dias },
      { origen: "sin-datos", disponible: false, desactualizado: true, aviso: AVISO_SIN_DATOS, dias: [] }
    );
    const linea = JSON.parse(avisos[0]!);
    assert.equal(linea.evento, "dependencia_caida");
    assert.equal(linea.servicio, "open-meteo");
    assert.equal(linea.motivo, "timeout");
  });

  it("si falla la escritura en DynamoDB igual devuelve el pronóstico", async () => {
    const repo = crearRepoFalso({ configuraciones: CONFIG_LA_PLATA });
    repo.guardarClima = async () => {
      throw new Error("ProvisionedThroughputExceeded");
    };
    const { servicio } = crearServicio({ repo });

    const res = await servicio.obtenerClimaUsuario("u1");
    assert.equal(res.origen, "open-meteo");
    assert.equal(res.disponible, true);
    assert.equal(res.aviso, null);
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

  it("circuit breaker: tras 2 caídas seguidas deja de llamar a Open-Meteo", async () => {
    const configuraciones = Object.fromEntries(
      ["a", "b", "c", "d", "e"].map((u) => [u, { usuarioID: u, ubicacion: { lat: 1, lon: 1 } }])
    );
    const repo = crearRepoFalso({ configuraciones });
    const { servicio, llamadasApi } = crearServicio({
      repo,
      pronostico: async () => {
        throw caida();
      },
    });

    const res = await servicio.refrescarTodos();
    assert.equal(llamadasApi(), 2);
    assert.equal(res.fallidos.length, 2);
    assert.equal(res.omitidosPorProveedor, 3);
    assert.equal(res.pendientes, 0);
  });

  it("un éxito reinicia el contador de caídas", async () => {
    const lats: Record<string, number> = { a: 1, b: 2, c: 1, d: 1 };
    const configuraciones = Object.fromEntries(
      Object.entries(lats).map(([u, lat]) => [u, { usuarioID: u, ubicacion: { lat, lon: 1 } }])
    );
    const repo = crearRepoFalso({ configuraciones });
    const { servicio, llamadasApi } = crearServicio({
      repo,
      pronostico: async ({ lat }) => {
        if (lat === 1) throw caida();
        return diasPronostico();
      },
    });

    const res = await servicio.refrescarTodos();
    assert.equal(llamadasApi(), 4); // a falla, b ok (reinicia), c y d fallan
    assert.equal(res.actualizados, 1);
    assert.equal(res.omitidosPorProveedor, 0);
  });

  it("deja de empezar usuarios si se acaba el tiempo de la invocación y devuelve el resumen", async () => {
    const configuraciones = Object.fromEntries(["a", "b", "c"].map((u) => [u, { usuarioID: u, ubicacion: { lat: 2, lon: 1 } }]));
    const repo = crearRepoFalso({ configuraciones });
    const { servicio, llamadasApi } = crearServicio({ repo });
    let restante = 25_000;

    const res = await servicio.refrescarTodos({
      plazo: () => {
        restante -= 7_000; // cada consulta consume 7 s
        return restante;
      },
    });
    assert.equal(llamadasApi(), 2); // con 18 s y 11 s se empieza; con 4 s ya no
    assert.equal(res.actualizados, 2);
    assert.equal(res.pendientes, 1);
  });
});
