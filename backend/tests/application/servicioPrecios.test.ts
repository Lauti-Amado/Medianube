import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { crearServicioPrecios, type ConfigPrecios, type ResultadoPrecios } from "../../src/application/precios/servicioPrecios";
import { ErrorServicioExterno, ErrorValidacion } from "../../src/domain/errores";
import type { CompraHistorica, Producto } from "../../src/domain/precios/tipos";
import type {
  ContextoPrecios,
  PreciosRepositorioPort,
  PropuestaLLM,
  SugerenciaGuardada,
  SugeridorPreciosPort,
} from "../../src/ports/precios";

const AHORA = new Date("2026-10-31T15:00:00Z");
const USUARIO = "user_test_123";
const CONFIG: ConfigPrecios = { margenObjetivoDefecto: 0.6, margenMinimo: 0.3, topeSubaPct: 0.25, ventanaHistorialDias: 90 };

// 6 compras de cada insumo: harina a $280/kg y manteca a $1.200/kg.
const COMPRAS: CompraHistorica[] = Array.from({ length: 6 }, (_, i) => [
  { insumo: "Harina 000 x 25 kg", fecha: `2026-10-0${i + 1}`, precioUnitario: 7000 },
  { insumo: "Manteca x 5 kg", fecha: `2026-10-0${i + 1}`, precioUnitario: 6000 },
]).flat();

const MEDIALUNA: Producto = {
  productoID: "medialuna",
  nombre: "Medialuna de manteca",
  categoria: "panadería",
  precioActual: 420,
  receta: [
    { insumo: "harina 000", cantidad: 50, unidad: "g" },
    { insumo: "manteca", cantidad: 20, unidad: "g" },
  ],
};
const PAN: Producto = {
  productoID: "pan-frances",
  nombre: "Pan francés (kg)",
  categoria: "panadería",
  precioActual: 2100,
  receta: [{ insumo: "harina 000", cantidad: 0.7, unidad: "kg" }],
};
const CAFE: Producto = {
  productoID: "cafe",
  nombre: "Café con leche",
  categoria: "bebidas",
  precioActual: 1400,
  receta: [{ insumo: "leche", cantidad: 0.2, unidad: "l" }],
};
const ALFAJOR: Producto = { productoID: "alfajor", nombre: "Alfajor de maicena", precioActual: 650 };

// Harina +17.1 % ($328/kg) y manteca +7.5 % ($1.290/kg).
const TICKET = {
  proveedor: "Molino Cañuelas",
  fecha: "2026-10-31",
  items: [
    { descripcion: "Harina 000 x 25 kg Cañuelas", cantidad: 4, precioUnitario: 8200 },
    { descripcion: "Manteca x 5 kg", cantidad: 2, precioUnitario: 6450 },
  ],
};

const EMPAREJAMIENTOS_OK: PropuestaLLM["emparejamientos"] = [
  { indiceItem: 0, insumo: "harina 000", certeza: "alta" },
  { indiceItem: 1, insumo: "manteca", certeza: "alta" },
];

function crearEntorno({
  productos = [MEDIALUNA, PAN, CAFE, ALFAJOR],
  compras = COMPRAS,
  sugerir = async (): Promise<PropuestaLLM> => ({ emparejamientos: EMPAREJAMIENTOS_OK, sugerencias: [] }),
}: {
  productos?: Producto[];
  compras?: CompraHistorica[];
  sugerir?: (contexto: ContextoPrecios) => Promise<PropuestaLLM>;
} = {}) {
  const guardadas: SugerenciaGuardada[][] = [];
  const contextos: ContextoPrecios[] = [];
  const advertencias: string[] = [];
  const llamadas = { listarCompras: [] as string[] };

  const repositorio: PreciosRepositorioPort = {
    async listarCompras(_usuarioID, desde) {
      llamadas.listarCompras.push(desde);
      return compras;
    },
    async listarProductos() {
      return productos;
    },
    async obtenerConfiguracion() {
      return { margenObjetivo: 0.55, tipoNegocio: "panaderia" };
    },
    async guardarSugerencias(_usuarioID, sugerencias) {
      guardadas.push(sugerencias);
    },
  };
  const sugeridor: SugeridorPreciosPort = {
    versionPrompt: "precios-test",
    async sugerir(contexto) {
      contextos.push(contexto);
      return sugerir(contexto);
    },
  };
  const servicio = crearServicioPrecios({
    repositorio,
    sugeridor,
    config: CONFIG,
    ahora: () => AHORA,
    log: { info() {}, warn: (m: string) => advertencias.push(m), error() {} },
  });
  return { servicio, guardadas, contextos, advertencias, llamadas };
}

const porID = (r: ResultadoPrecios, id: string) => r.sugerencias.find((s) => s.productoID === id)!;

describe("servicio de precios", () => {
  it("arma el contexto para el LLM con números ya calculados", async () => {
    const { servicio, contextos, llamadas } = crearEntorno();
    await servicio.sugerirPrecios(USUARIO, TICKET);

    assert.deepEqual(llamadas.listarCompras, ["2026-08-02"], "ventana de 90 días");
    const ctx = contextos[0]!;
    assert.equal(ctx.negocio.margenObjetivo, 0.55, "usa el margen del negocio");
    assert.equal(ctx.ticket.items[0]!.candidato, "harina 000");
    assert.equal(ctx.ticket.items[0]!.variacionCandidatoPct, 17.1);
    const medialuna = ctx.productos.find((p) => p.productoID === "medialuna")!;
    assert.equal(medialuna.costoActual, 38);
    assert.equal(medialuna.costoNuevoEstimado, 42.2);
    assert.ok(!ctx.productos.some((p) => p.productoID === "alfajor"), "los productos sin receta no van al LLM");
  });

  it("usa la propuesta del LLM cuando respeta las guardas", async () => {
    const { servicio, guardadas } = crearEntorno({
      sugerir: async () => ({
        emparejamientos: EMPAREJAMIENTOS_OK,
        sugerencias: [{ productoID: "medialuna", precioSugerido: 480, confianza: "alta", justificacion: "La harina subió 17 %." }],
      }),
    });
    const r = await servicio.sugerirPrecios(USUARIO, TICKET);

    assert.equal(r.origen, "llm");
    assert.deepEqual(r.productosSinReceta, ["Alfajor de maicena"]);
    assert.deepEqual(
      r.sugerencias.map((s) => s.productoID).sort(),
      ["medialuna", "pan-frances"],
      "el café no lleva insumos del ticket"
    );

    const medialuna = porID(r, "medialuna");
    assert.equal(medialuna.precioSugerido, 480);
    assert.equal(medialuna.origen, "llm");
    assert.equal(medialuna.ajustadoPorReglas, false);
    assert.equal(medialuna.confianza, "alta");
    assert.equal(medialuna.variacionPct, 14.3);
    assert.equal(medialuna.estado, "ajustar");
    assert.equal(medialuna.margenResultante, 0.912);
    assert.equal(medialuna.justificacion, "La harina subió 17 %.");
    assert.deepEqual(medialuna.insumosAfectados, ["harina 000", "manteca"]);

    // El pan no tuvo propuesta del LLM: regla de traslado proporcional, con confianza baja.
    const pan = porID(r, "pan-frances");
    assert.equal(pan.origen, "reglas");
    assert.equal(pan.precioSugerido, 2500); // 2100 × 229.6 / 196 = 2460 → redondeo a $50
    assert.equal(pan.confianza, "baja");

    assert.equal(guardadas.length, 1);
    assert.equal(guardadas[0]!.length, 2);
    assert.equal(guardadas[0]![0]!.versionPrompt, "precios-test");
    assert.equal(guardadas[0]![0]!.generadaEn, AHORA.toISOString());

    assert.deepEqual(
      r.insumos.map((v) => [v.insumo, v.precioAnterior, v.precioNuevo, v.variacionPct]),
      [
        ["harina 000", 280, 328, 17.1],
        ["manteca", 1200, 1290, 7.5],
      ]
    );
  });

  it("recorta una propuesta del LLM que supera el tope de suba", async () => {
    const { servicio } = crearEntorno({
      sugerir: async () => ({
        emparejamientos: EMPAREJAMIENTOS_OK,
        sugerencias: [{ productoID: "medialuna", precioSugerido: 900, confianza: "alta", justificacion: "Suba fuerte." }],
      }),
    });
    const medialuna = porID(await servicio.sugerirPrecios(USUARIO, TICKET), "medialuna");
    assert.equal(medialuna.precioSugerido, 520); // techo 525 → redondeo hacia abajo
    assert.equal(medialuna.ajustadoPorReglas, true);
    assert.match(medialuna.justificacion, /tope de suba/);
  });

  it("si el LLM falla responde igual con reglas y confianza baja", async () => {
    const { servicio, advertencias } = crearEntorno({
      sugerir: async () => {
        throw new ErrorServicioExterno("timeout");
      },
    });
    const r = await servicio.sugerirPrecios(USUARIO, TICKET);

    assert.equal(r.origen, "reglas");
    const medialuna = porID(r, "medialuna");
    assert.equal(medialuna.precioSugerido, 470); // 420 × 42.2 / 38 = 466.4 → $470
    assert.equal(medialuna.confianza, "baja");
    assert.match(medialuna.justificacion, /harina 000 \+17\.1 %/);
    assert.equal(advertencias.length, 1);
  });

  it("descarta de la respuesta del LLM ítems, insumos y productos desconocidos", async () => {
    const { servicio } = crearEntorno({
      sugerir: async () => ({
        emparejamientos: [
          { indiceItem: 7, insumo: "harina 000", certeza: "alta" },
          { indiceItem: 0, insumo: "insumo inventado", certeza: "alta" },
        ],
        sugerencias: [{ productoID: "no-existe", precioSugerido: 1, confianza: "alta", justificacion: "x" }],
      }),
    });
    const r = await servicio.sugerirPrecios(USUARIO, TICKET);
    assert.equal(r.origen, "llm");
    assert.deepEqual(
      r.insumos.map((v) => v.insumo),
      ["harina 000", "manteca"],
      "se usan los candidatos por nombre"
    );
    assert.ok(r.sugerencias.every((s) => s.origen === "reglas"));
  });

  it("respeta cuando el LLM descarta un candidato por nombre", async () => {
    const { servicio } = crearEntorno({
      sugerir: async () => ({
        emparejamientos: [
          { indiceItem: 0, insumo: "harina 000", certeza: "alta" },
          { indiceItem: 1, insumo: null, certeza: "alta" },
        ],
        sugerencias: [],
      }),
    });
    const r = await servicio.sugerirPrecios(USUARIO, TICKET);
    assert.deepEqual(r.insumos.map((v) => v.insumo), ["harina 000"]);
    assert.equal(porID(r, "medialuna").costoNuevo, 40.4, "la manteca mantiene el costo histórico");
  });

  it("con receta incompleta no inventa costos y marca confianza baja", async () => {
    const conHuevo: Producto = {
      ...MEDIALUNA,
      receta: [...MEDIALUNA.receta!, { insumo: "huevo", cantidad: 0.1, unidad: "u" }],
    };
    const { servicio } = crearEntorno({ productos: [conHuevo] });
    const medialuna = porID(await servicio.sugerirPrecios(USUARIO, TICKET), "medialuna");
    assert.equal(medialuna.costoNuevo, null);
    assert.equal(medialuna.margenResultante, null);
    assert.equal(medialuna.confianza, "baja");
    assert.equal(medialuna.precioSugerido, 420);
    assert.equal(medialuna.estado, "estable");
    assert.match(medialuna.justificacion, /No se pudo calcular el costo/);
  });

  it("sin historial baja la confianza aunque el LLM la declare alta", async () => {
    const { servicio } = crearEntorno({
      compras: [],
      sugerir: async () => ({
        emparejamientos: EMPAREJAMIENTOS_OK,
        sugerencias: [{ productoID: "medialuna", precioSugerido: 430, confianza: "alta", justificacion: "Primera compra." }],
      }),
    });
    const r = await servicio.sugerirPrecios(USUARIO, TICKET);
    const medialuna = porID(r, "medialuna");
    assert.equal(medialuna.confianza, "baja");
    assert.equal(medialuna.costoAnterior, null);
    assert.equal(r.insumos[0]!.variacionPct, null);
  });

  it("no llama al LLM ni guarda nada si ningún producto tiene receta", async () => {
    const { servicio, contextos, guardadas } = crearEntorno({ productos: [ALFAJOR] });
    const r = await servicio.sugerirPrecios(USUARIO, TICKET);
    assert.equal(contextos.length, 0);
    assert.equal(guardadas.length, 0);
    assert.deepEqual(r.sugerencias, []);
    assert.deepEqual(r.productosSinReceta, ["Alfajor de maicena"]);
  });

  it("rechaza un ticket vacío sin consultar la base", async () => {
    const { servicio, llamadas } = crearEntorno();
    await assert.rejects(servicio.sugerirPrecios(USUARIO, { items: [] }), ErrorValidacion);
    assert.equal(llamadas.listarCompras.length, 0);
  });
});
