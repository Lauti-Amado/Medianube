// Adaptador de salida: implementa SugeridorPreciosPort con la API de Claude (SDK oficial de Anthropic).
// - Salida JSON garantizada con structured outputs (output_config.format), sin tool_choice forzado.
// - `fallbacks: "default"`: si el modelo rechaza la solicitud por política, la API la reintenta del lado
//   del servidor en el modelo recomendado, dentro de la misma llamada.
// - Sin reintentos del SDK: el timeout de API Gateway es de 30 s y, si esto falla, el caso de uso
//   responde igual con reglas.

import Anthropic from "@anthropic-ai/sdk";
import { ErrorServicioExterno, type MotivoFalla } from "../../../domain/errores";
import type { Confianza, Emparejamiento } from "../../../domain/precios/tipos";
import type { PropuestaLLM, PropuestaPrecioLLM, SugeridorPreciosPort } from "../../../ports/precios";
import { construirMensajeUsuario, ESQUEMA_RESPUESTA, SYSTEM_PROMPT, VERSION_PROMPT } from "./promptPrecios";

export type Esfuerzo = "low" | "medium" | "high";

export interface OpcionesSugeridorClaude {
  apiKey?: string;
  modelo: string;
  esfuerzo: Esfuerzo;
  timeoutMs: number;
  maxTokens?: number;
  /** Para tests: un cliente con la misma forma que el del SDK. */
  cliente?: Pick<Anthropic, "beta">;
}

const CONFIANZAS = new Set<Confianza>(["alta", "media", "baja"]);

function comoConfianza(valor: unknown): Confianza {
  return CONFIANZAS.has(valor as Confianza) ? (valor as Confianza) : "baja";
}

const falla = (mensaje: string, motivo: MotivoFalla, cause?: unknown) =>
  new ErrorServicioExterno(mensaje, { motivo, servicio: "claude", cause });

/**
 * Clasifica un error del SDK de Anthropic. El orden importa: APIConnectionTimeoutError hereda de
 * APIConnectionError, y esta de APIError.
 */
export function clasificarErrorClaude(error: unknown): MotivoFalla {
  if (error instanceof Anthropic.APIConnectionTimeoutError || error instanceof Anthropic.APIUserAbortError) return "timeout";
  if (error instanceof Anthropic.APIConnectionError) return "no_disponible";
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return "sin_configuracion";
  }
  if (error instanceof Anthropic.RateLimitError) return "limite";
  if (error instanceof Anthropic.APIError && error.status === 529) return "limite"; // overloaded
  return "no_disponible";
}

/** Convierte el JSON de la respuesta en una PropuestaLLM. Lanza si no tiene la forma esperada. */
export function parsearPropuesta(texto: string): PropuestaLLM {
  let datos: { emparejamientos?: unknown; sugerencias?: unknown };
  try {
    datos = JSON.parse(texto);
  } catch (error) {
    throw falla("Claude devolvió una respuesta que no es JSON.", "respuesta_invalida", error);
  }
  if (!Array.isArray(datos?.emparejamientos) || !Array.isArray(datos?.sugerencias)) {
    throw falla("La respuesta de Claude no tiene emparejamientos y sugerencias.", "respuesta_invalida");
  }

  const emparejamientos: Emparejamiento[] = datos.emparejamientos.map((e: Record<string, unknown>) => ({
    indiceItem: Number(e?.indiceItem),
    insumo: typeof e?.insumo === "string" ? e.insumo : null,
    certeza: comoConfianza(e?.certeza),
  }));
  const sugerencias: PropuestaPrecioLLM[] = datos.sugerencias.map((s: Record<string, unknown>) => ({
    productoID: String(s?.productoID ?? ""),
    precioSugerido: Number(s?.precioSugerido),
    confianza: comoConfianza(s?.confianza),
    justificacion: typeof s?.justificacion === "string" ? s.justificacion : "",
  }));
  return { emparejamientos, sugerencias };
}

export function crearSugeridorClaude({
  apiKey,
  modelo,
  esfuerzo,
  timeoutMs,
  maxTokens = 16000,
  cliente = new Anthropic({ apiKey, timeout: timeoutMs, maxRetries: 0 }),
}: OpcionesSugeridorClaude): SugeridorPreciosPort {
  return {
    versionPrompt: VERSION_PROMPT,

    async sugerir(contexto, opciones = {}) {
      let respuesta: Anthropic.Beta.BetaMessage;
      try {
        respuesta = await cliente.beta.messages.create(
          {
            model: modelo,
            max_tokens: maxTokens,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
            messages: [{ role: "user", content: construirMensajeUsuario(contexto) }],
            output_config: {
              effort: esfuerzo,
              format: { type: "json_schema", schema: ESQUEMA_RESPUESTA as unknown as Record<string, unknown> },
            },
          },
          // Timeout por request: el caso de uso lo acota a lo que le queda a la Lambda.
          { timeout: Math.min(opciones.timeoutMs ?? timeoutMs, timeoutMs) }
        );
      } catch (error) {
        const motivo = clasificarErrorClaude(error);
        const detalle = error instanceof Anthropic.APIError ? `HTTP ${error.status ?? "sin respuesta"}` : String(error);
        throw falla(`La API de Claude falló (${motivo}, ${detalle}).`, motivo, error);
      }

      // Revisar stop_reason antes de leer el contenido: en un rechazo o un corte, el JSON no es confiable.
      if (respuesta.stop_reason === "refusal") {
        throw falla("Claude rechazó la solicitud de precios.", "rechazo");
      }
      if (respuesta.stop_reason === "max_tokens") {
        throw falla("La respuesta de Claude quedó incompleta (max_tokens).", "respuesta_invalida");
      }

      const texto = respuesta.content
        .filter((bloque): bloque is Anthropic.Beta.BetaTextBlock => bloque.type === "text")
        .map((bloque) => bloque.text)
        .join("");
      return parsearPropuesta(texto);
    },
  };
}
