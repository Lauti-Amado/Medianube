// Caso de uso: sugerir precios de venta a partir de un ticket de compra.
// Los números los calcula el dominio, el LLM empareja insumos y propone/explica, y las guardas
// tienen la última palabra. Si el LLM falla o no hay tiempo para esperarlo, se responde igual con
// sugerencias por reglas y el motivo explícito (degradado / motivoDegradacion).
// No conoce AWS ni la API de Claude: depende solo de puertos.

import {
  aplicarGuardas,
  confianzaMinima,
  confianzaPorEvidencia,
  costoReceta,
  emparejarPorNombre,
  estadoPorVariacion,
  margen,
  precioPorMargen,
  precioPorUnidadBase,
  resumirHistorial,
  validarTicket,
  variacionPct,
} from "../../domain/precios/reglas";
import type {
  Emparejamiento,
  PrecioBase,
  Producto,
  ResumenInsumo,
  SugerenciaPrecio,
  Ticket,
  VariacionInsumo,
} from "../../domain/precios/tipos";
import { type MotivoFalla, motivoDe, ErrorServicioExterno } from "../../domain/errores";
import type { LoggerPort } from "../../ports/logger";
import { registrarCaida } from "../dependencias";
import type {
  ContextoPrecios,
  PreciosRepositorioPort,
  PropuestaLLM,
  PropuestaPrecioLLM,
  SugeridorPreciosPort,
} from "../../ports/precios";

const MS_POR_DIA = 86_400_000;
const LARGO_MAX_JUSTIFICACION = 400;

export interface ConfigPrecios {
  margenObjetivoDefecto: number;
  margenMinimo: number;
  topeSubaPct: number;
  ventanaHistorialDias: number;
  /** Tiempo que se reserva para guardar y responder después del LLM (ms). */
  margenRespuestaMs?: number;
  /** Si queda menos que esto para el LLM, ni se lo llama (ms). */
  minimoLlmMs?: number;
}

/** Por qué una respuesta salió sin IA. "sin_api_key" agrupa key faltante o inválida. */
export type MotivoDegradacion = Exclude<MotivoFalla, "sin_configuracion"> | "sin_api_key" | "sin_tiempo";

const aMotivoDegradacion = (m: MotivoFalla): MotivoDegradacion => (m === "sin_configuracion" ? "sin_api_key" : m);

export interface ResultadoPrecios {
  usuarioID: string;
  origen: "llm" | "reglas";
  versionPrompt: string;
  generadaEn: string;
  insumos: VariacionInsumo[];
  sugerencias: SugerenciaPrecio[];
  /** Productos que no se pudieron evaluar porque no tienen receta cargada. */
  productosSinReceta: string[];
  /** true si se quería usar el LLM y no se pudo: las sugerencias salen solo de reglas. */
  degradado: boolean;
  motivoDegradacion: MotivoDegradacion | null;
  /** false si las sugerencias no se pudieron guardar en Productos (la respuesta igual es válida). */
  guardado: boolean;
}

export interface DependenciasServicioPrecios {
  repositorio: PreciosRepositorioPort;
  sugeridor: SugeridorPreciosPort;
  config: ConfigPrecios;
  ahora?: () => Date;
  log?: LoggerPort;
}

export interface ServicioPrecios {
  /** `plazo`: ms que le quedan a la invocación (Lambda getRemainingTimeInMillis). */
  sugerirPrecios(usuarioID: string, ticket: unknown, opciones?: { plazo?: () => number }): Promise<ResultadoPrecios>;
}

const TEXTO_MOTIVO: Record<string, string> = {
  margen_minimo: "Se subió hasta el margen mínimo",
  tope_suba: "Se limitó al tope de suba por ajuste",
  tope_suba_bajo_margen_minimo: "Se limitó al tope de suba: el margen queda por debajo del mínimo y conviene otro ajuste más adelante",
  propuesta_invalida: "La propuesta de la IA no era válida; se usó el precio por margen mínimo",
};

/** Descarta de la respuesta del LLM todo lo que no corresponda a ítems, insumos o productos conocidos. */
function sanearPropuesta(propuesta: PropuestaLLM, ticket: Ticket, insumos: Set<string>, productos: Set<string>) {
  const emparejamientos = new Map<number, Emparejamiento>();
  for (const e of propuesta.emparejamientos ?? []) {
    if (!Number.isInteger(e.indiceItem) || e.indiceItem < 0 || e.indiceItem >= ticket.items.length) continue;
    if (e.insumo !== null && !insumos.has(e.insumo)) continue;
    emparejamientos.set(e.indiceItem, e);
  }
  const sugerencias = new Map<string, PropuestaPrecioLLM>();
  for (const s of propuesta.sugerencias ?? []) {
    if (!productos.has(s.productoID) || typeof s.precioSugerido !== "number") continue;
    sugerencias.set(s.productoID, {
      ...s,
      justificacion: String(s.justificacion ?? "").trim().slice(0, LARGO_MAX_JUSTIFICACION),
    });
  }
  return { emparejamientos, sugerencias };
}

/**
 * Corta una promesa a los `ms` dados aunque quien la produce no respete su timeout.
 * Red de seguridad: el adaptador de Claude ya corta solo, pero la respuesta no puede depender de eso.
 */
function conPlazo<T>(promesa: Promise<T>, ms: number): Promise<T> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const corte = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(
      () => rechazar(new ErrorServicioExterno(`El LLM no respondió en ${ms} ms.`, { motivo: "timeout", servicio: "claude" })),
      ms
    );
  });
  return Promise.race([promesa, corte]).finally(() => clearTimeout(temporizador));
}

function justificacionPorReglas(afectados: VariacionInsumo[], sinCosto: boolean): string {
  if (sinCosto) return "No se pudo calcular el costo: la receta tiene insumos sin precio de compra.";
  const conVariacion = afectados.filter((v) => v.variacionPct !== null);
  if (conVariacion.length === 0) return "Sin compras anteriores para comparar; se calculó con el margen objetivo.";
  const detalle = conVariacion.map((v) => `${v.insumo} ${v.variacionPct! > 0 ? "+" : ""}${v.variacionPct} %`).join(", ");
  return `Cambió el costo de insumos de la receta (${detalle}); se traslada al precio para mantener el margen.`;
}

export function crearServicioPrecios({
  repositorio,
  sugeridor,
  config,
  ahora = () => new Date(),
  log = console,
}: DependenciasServicioPrecios): ServicioPrecios {
  const { margenRespuestaMs = 4_000, minimoLlmMs = 3_000 } = config;
  return {
    async sugerirPrecios(usuarioID, ticketCrudo, { plazo } = {}) {
      const ticket = validarTicket(ticketCrudo);
      const instante = ahora();
      const desde = new Date(instante.getTime() - config.ventanaHistorialDias * MS_POR_DIA).toISOString().slice(0, 10);

      const [compras, productos, configuracion] = await Promise.all([
        repositorio.listarCompras(usuarioID, desde),
        repositorio.listarProductos(usuarioID),
        repositorio.obtenerConfiguracion(usuarioID),
      ]);

      const conReceta = productos.filter((p) => p.receta && p.receta.length > 0);
      const productosSinReceta = productos.filter((p) => !conReceta.includes(p)).map((p) => p.nombre);
      const margenObjetivoNegocio = configuracion?.margenObjetivo ?? config.margenObjetivoDefecto;
      const margenObjetivoDe = (p: Producto) => p.margenObjetivo ?? margenObjetivoNegocio;

      const insumos = [...new Set(conReceta.flatMap((p) => p.receta!.map((r) => r.insumo)))];
      const historial = resumirHistorial(compras, insumos);
      const costosAnteriores = new Map<string, PrecioBase>(
        [...historial].map(([insumo, r]) => [insumo, { precio: r.ultimo.precio, unidad: r.ultimo.unidad }])
      );

      const preciosTicket = ticket.items.map(precioPorUnidadBase);
      const candidatos = ticket.items.map((item) => emparejarPorNombre(item.descripcion, insumos));
      const costosCandidatos = aplicarTicket(costosAnteriores, preciosTicket, candidatos.map((c) => c?.insumo ?? null));

      const contexto: ContextoPrecios = {
        negocio: {
          tipo: configuracion?.tipoNegocio ?? null,
          margenObjetivo: margenObjetivoNegocio,
          margenMinimo: config.margenMinimo,
          topeSubaPct: config.topeSubaPct,
        },
        ticket: {
          proveedor: ticket.proveedor ?? null,
          fecha: ticket.fecha ?? null,
          items: ticket.items.map((item, indice) => ({
            indice,
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            precioBase: preciosTicket[indice]!,
            candidato: candidatos[indice]?.insumo ?? null,
            variacionCandidatoPct: variacionContra(historial.get(candidatos[indice]?.insumo ?? ""), preciosTicket[indice]!),
          })),
        },
        insumos: insumos.map((insumo) => {
          const r = historial.get(insumo);
          return {
            insumo,
            ultimoPrecio: r?.ultimo.precio ?? null,
            unidad: r?.ultimo.unidad ?? null,
            promedio: r?.promedio ?? null,
            compras: r?.compras ?? 0,
          };
        }),
        productos: conReceta.map((p) => {
          const actual = costoReceta(p.receta!, costosAnteriores);
          const estimado = costoReceta(p.receta!, costosCandidatos);
          return {
            productoID: p.productoID,
            nombre: p.nombre,
            categoria: p.categoria ?? null,
            precioActual: p.precioActual,
            receta: p.receta!,
            costoActual: actual.faltantes.length === 0 ? redondear2(actual.costo) : null,
            costoNuevoEstimado: estimado.faltantes.length === 0 ? redondear2(estimado.costo) : null,
            margenObjetivo: margenObjetivoDe(p),
          };
        }),
      };

      // 1. Pedirle al LLM emparejamientos y propuestas. Si falla, seguir solo con reglas.
      let origen: "llm" | "reglas" = "reglas";
      let motivoDegradacion: MotivoDegradacion | null = null;
      let propuesta: ReturnType<typeof sanearPropuesta> = { emparejamientos: new Map(), sugerencias: new Map() };
      if (conReceta.length > 0) {
        // Tiempo para el LLM: lo que le queda a la Lambda menos lo necesario para guardar y responder.
        // Sin plazo (tests, invocación local) se respeta el timeout propio del sugeridor.
        const disponibleMs = plazo ? plazo() - margenRespuestaMs : undefined;
        if (disponibleMs !== undefined && disponibleMs < minimoLlmMs) {
          motivoDegradacion = "sin_tiempo";
          registrarCaida(log, {
            servicio: "claude",
            error: `quedaban ${disponibleMs} ms para el LLM`,
            motivo: "timeout",
            usuarioID,
            consecuencia: "no se llamó al LLM; se usan reglas",
          });
        } else {
          try {
            const llamada = sugeridor.sugerir(contexto, disponibleMs !== undefined ? { timeoutMs: disponibleMs } : {});
            const cruda = disponibleMs !== undefined ? await conPlazo(llamada, disponibleMs) : await llamada;
            propuesta = sanearPropuesta(cruda, ticket, new Set(insumos), new Set(conReceta.map((p) => p.productoID)));
            origen = "llm";
          } catch (error) {
            motivoDegradacion = aMotivoDegradacion(motivoDe(error));
            registrarCaida(log, { servicio: "claude", error, usuarioID, consecuencia: "se usan reglas" });
          }
        }
      }

      // 2. Emparejamiento final: el del LLM si lo dio, si no el candidato por nombre.
      const emparejamientos: Emparejamiento[] = ticket.items.map(
        (_, indiceItem) =>
          propuesta.emparejamientos.get(indiceItem) ?? {
            indiceItem,
            insumo: candidatos[indiceItem]?.insumo ?? null,
            certeza: candidatos[indiceItem]?.certeza ?? "baja",
          }
      );

      const variaciones: VariacionInsumo[] = emparejamientos
        .filter((e) => e.insumo !== null)
        .map((e) => {
          const nuevo = preciosTicket[e.indiceItem]!;
          const r = historial.get(e.insumo!);
          const comparable = r && r.ultimo.unidad === nuevo.unidad ? r : undefined;
          return {
            insumo: e.insumo!,
            descripcionTicket: ticket.items[e.indiceItem]!.descripcion,
            unidad: nuevo.unidad,
            precioAnterior: comparable ? redondear2(comparable.ultimo.precio) : null,
            precioNuevo: redondear2(nuevo.precio),
            variacionPct: variacionPct(nuevo.precio, comparable?.ultimo.precio),
            variacionVsPromedioPct: variacionPct(nuevo.precio, comparable?.promedio),
            certeza: e.certeza,
          };
        });

      const costosNuevos = aplicarTicket(costosAnteriores, preciosTicket, emparejamientos.map((e) => e.insumo));
      const insumosDelTicket = new Set(variaciones.map((v) => v.insumo));

      // 3. Sugerencia por producto afectado: propuesta (LLM o regla) → guardas → estado y confianza.
      const sugerencias: SugerenciaPrecio[] = [];
      for (const producto of conReceta) {
        const afectados = variaciones.filter((v) => producto.receta!.some((r) => r.insumo === v.insumo));
        if (afectados.length === 0) continue;

        const anterior = costoReceta(producto.receta!, costosAnteriores);
        const nuevo = costoReceta(producto.receta!, costosNuevos);
        const recetaCompleta = nuevo.faltantes.length === 0;
        const costoAnterior = anterior.faltantes.length === 0 ? anterior.costo : null;
        const costoNuevo = recetaCompleta ? nuevo.costo : null;
        const margenObjetivo = margenObjetivoDe(producto);

        const deLLM = propuesta.sugerencias.get(producto.productoID);
        const porRegla =
          costoAnterior && costoNuevo
            ? producto.precioActual * (costoNuevo / costoAnterior)
            : costoNuevo
              ? Math.max(producto.precioActual, precioPorMargen(costoNuevo, margenObjetivo))
              : producto.precioActual;

        const guardas = aplicarGuardas(deLLM?.precioSugerido ?? porRegla, {
          costoNuevo: costoNuevo ?? 0,
          precioActual: producto.precioActual,
          margenMinimo: config.margenMinimo,
          topeSubaPct: config.topeSubaPct,
        });

        let precioSugerido = guardas.precio;
        let variacion = variacionPct(precioSugerido, producto.precioActual) ?? 0;
        const estado = estadoPorVariacion(variacion);
        if (estado === "estable") {
          // Un cambio menor al umbral no se sugiere: evita ruido por redondeo.
          precioSugerido = producto.precioActual;
          variacion = 0;
        }

        const confianza = confianzaMinima(
          confianzaPorEvidencia({
            recetaCompleta,
            comprasMinimas: Math.min(...afectados.map((v) => historial.get(v.insumo)?.compras ?? 0)),
            certezaEmparejamiento: confianzaMinima(...afectados.map((v) => v.certeza)),
          }),
          deLLM ? deLLM.confianza : "baja"
        );

        const base = deLLM?.justificacion || justificacionPorReglas(afectados, costoNuevo === null);
        const nota = guardas.motivo ? ` ${TEXTO_MOTIVO[guardas.motivo]}.` : "";

        sugerencias.push({
          productoID: producto.productoID,
          nombre: producto.nombre,
          categoria: producto.categoria ?? null,
          costoAnterior: costoAnterior === null ? null : redondear2(costoAnterior),
          costoNuevo: costoNuevo === null ? null : redondear2(costoNuevo),
          precioActual: producto.precioActual,
          precioSugerido,
          variacionPct: variacion,
          margenResultante: costoNuevo === null ? null : margen(precioSugerido, costoNuevo),
          estado,
          confianza,
          justificacion: base + nota,
          insumosAfectados: afectados.map((v) => v.insumo),
          ajustadoPorReglas: guardas.ajustado,
          origen: deLLM ? "llm" : "reglas",
        });
      }

      const generadaEn = instante.toISOString();
      // Guardar es un efecto secundario: si falla, la sugerencia calculada se devuelve igual.
      let guardado = true;
      if (sugerencias.length > 0) {
        try {
          await repositorio.guardarSugerencias(
            usuarioID,
            sugerencias.map((s) => ({ ...s, generadaEn, versionPrompt: sugeridor.versionPrompt }))
          );
        } catch (error) {
          guardado = false;
          log.error(
            JSON.stringify({
              mensaje: "No se pudieron guardar las sugerencias; se devuelven igual",
              usuarioID,
              error: error instanceof Error ? error.message : String(error),
            })
          );
        }
      }

      log.info(
        JSON.stringify({
          mensaje: "Sugerencias de precios generadas",
          usuarioID,
          origen,
          items: ticket.items.length,
          insumosDelTicket: insumosDelTicket.size,
          sugerencias: sugerencias.length,
          motivoDegradacion,
          guardado,
        })
      );

      return {
        usuarioID,
        origen,
        versionPrompt: sugeridor.versionPrompt,
        generadaEn,
        insumos: variaciones,
        sugerencias,
        productosSinReceta,
        degradado: motivoDegradacion !== null,
        motivoDegradacion,
        guardado,
      };
    },
  };
}

/** Costos vigentes después del ticket: los del historial con los precios del ticket encima. */
function aplicarTicket(anteriores: Map<string, PrecioBase>, precios: PrecioBase[], insumoPorItem: Array<string | null>) {
  const costos = new Map(anteriores);
  insumoPorItem.forEach((insumo, i) => {
    if (insumo) costos.set(insumo, precios[i]!);
  });
  return costos;
}

function variacionContra(resumen: ResumenInsumo | undefined, nuevo: PrecioBase): number | null {
  if (!resumen || resumen.ultimo.unidad !== nuevo.unidad) return null;
  return variacionPct(nuevo.precio, resumen.ultimo.precio);
}

function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

