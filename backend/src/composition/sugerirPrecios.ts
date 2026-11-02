// Composition root de la Lambda `sugerirPrecios`: único lugar donde se leen variables de entorno
// y se conectan adaptadores con el caso de uso.
// Disparador: API Gateway (POST /precios/sugerir).

import { crearHandlerPrecios } from "../adapters/in/lambdaPrecios";
import { crearSugeridorClaude, type Esfuerzo } from "../adapters/out/claude/sugeridorPreciosClaude";
import { VERSION_PROMPT } from "../adapters/out/claude/promptPrecios";
import { crearPreciosRepositorioDynamo } from "../adapters/out/preciosRepositorioDynamo";
import { crearServicioPrecios } from "../application/precios/servicioPrecios";
import { ErrorServicioExterno } from "../domain/errores";
import type { SugeridorPreciosPort } from "../ports/precios";

const env = process.env;

function requerida(nombre: string): string {
  const valor = env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}.`);
  return valor;
}

const ESFUERZOS = new Set<Esfuerzo>(["low", "medium", "high"]);
const esfuerzo = (ESFUERZOS.has(env.ESFUERZO_LLM as Esfuerzo) ? env.ESFUERZO_LLM : "low") as Esfuerzo;

// Sin API key la Lambda igual funciona: el caso de uso cae en las reglas (origen "reglas").
const sugeridor: SugeridorPreciosPort = env.ANTHROPIC_API_KEY
  ? crearSugeridorClaude({
      apiKey: env.ANTHROPIC_API_KEY,
      modelo: env.MODELO_LLM || "claude-opus-5-5",
      esfuerzo,
      timeoutMs: Number(env.TIMEOUT_LLM_MS || 22_000),
    })
  : {
      versionPrompt: VERSION_PROMPT,
      async sugerir() {
        throw new ErrorServicioExterno("No hay ANTHROPIC_API_KEY configurada.", {
          motivo: "sin_configuracion",
          servicio: "claude",
        });
      },
    };

// Se inicializa fuera del handler para reutilizar los clientes entre invocaciones (warm start).
const servicio = crearServicioPrecios({
  repositorio: crearPreciosRepositorioDynamo({
    tablaFacturas: requerida("TABLA_FACTURAS"),
    tablaProductos: requerida("TABLA_PRODUCTOS"),
    tablaConfiguracion: requerida("TABLA_CONFIGURACION"),
  }),
  sugeridor,
  config: {
    margenObjetivoDefecto: Number(env.MARGEN_OBJETIVO_DEFECTO || 0.6),
    margenMinimo: Number(env.MARGEN_MINIMO || 0.3),
    topeSubaPct: Number(env.TOPE_SUBA_PCT || 0.25),
    ventanaHistorialDias: Number(env.VENTANA_HISTORIAL_DIAS || 90),
  },
});

export const handler = crearHandlerPrecios({
  servicio,
  permitirUsuarioQuery: env.PERMITIR_USUARIO_QUERY === "true",
});
