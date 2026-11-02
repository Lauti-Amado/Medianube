# ADR: Manejo de errores ante caídas de Open-Meteo y Claude

**Estado:** Aceptada · **Fecha:** 01/11/2026 · **Rama:** `feat/manejo-errores`

## Contexto

El backend depende de dos servicios externos que no controlamos: Open-Meteo (pronóstico del clima) y la
API de Claude (motor de precios). Ya había algunos fallbacks: la cache de clima vencida y el cálculo de
precios por reglas. Pero quedaban casos en que una caída externa terminaba como error para el frontend
o cortaba la Lambda:

| Hueco | Efecto |
|---|---|
| Open-Meteo caído y usuario sin cache | `GET /clima` respondía **502** |
| Refresco programado con Open-Meteo caído | Usuarios en serie con 5 s de timeout cada uno y Lambda de 10 s: **timeout** al 2.º o 3.º usuario, refresco a medias y sin resumen |
| 429/5xx momentáneo de Open-Meteo, o 200 sin días | Contaba como caída, o se guardaba un pronóstico vacío |
| LLM con 22 s fijos | Si DynamoDB ya había tardado, la Lambda pasaba los 30 s de API Gateway y el frontend recibía un 503 sin JSON |
| Falla al guardar las sugerencias | Se perdía la respuesta ya calculada y salía un **500** |
| Respuesta degradada | El frontend no sabía por qué. Los 500 no traían un id para buscarlos en CloudWatch |

## Decisión

**Una dependencia caída nunca es un error HTTP.** Se responde 200 con el mejor dato disponible y el
motivo explícito. Solo un problema propio (DynamoDB, un bug) da 5xx, y siempre como JSON con `requestId`.

### Escenarios

| Dependencia | Falla | Respuesta | Log |
|---|---|---|---|
| Open-Meteo | No responde (red, timeout, 429, 5xx), con cache | 200, cache con `desactualizado: true` + `aviso` | `dependencia_caida` |
| Open-Meteo | No responde, sin cache | 200, `disponible: false`, `origen: "sin-datos"`, `dias: []` + `aviso` | `dependencia_caida` |
| Open-Meteo | Refresco programado | Corta tras 2 caídas seguidas (`omitidosPorProveedor`) o cuando queda poco tiempo (`pendientes`). Siempre devuelve el resumen | `dependencia_caida` + resumen |
| Claude | Timeout, red, 5xx, 429/529, key faltante o inválida, rechazo, JSON inválido | 200 por reglas, `degradado: true`, `motivoDegradacion` | `dependencia_caida` |
| Claude | No queda tiempo para llamarlo | 200 por reglas, `motivoDegradacion: "sin_tiempo"` | `dependencia_caida` |
| DynamoDB | Falla al guardar las sugerencias | 200 con `guardado: false` | error |
| DynamoDB | Throttling al leer | 503 + `Retry-After: 2` + `requestId` | warn |
| — | Bug / error inesperado | 500 `{ error, requestId }`, sin detalles internos | error con stack |

### Plazos y reintentos

| Dónde | Regla | Motivo |
|---|---|---|
| Open-Meteo | 4 s por intento, 1 reintento solo ante errores transitorios, 300 ms de espera | Peor caso ≈ 8,5 s. Un 4xx o una respuesta mal formada no mejoran reintentando |
| `obtenerClima` | Lambda de 20 s (antes 10) e integración de API Gateway de 15 s (antes 12) | Margen para el reintento en el camino HTTP |
| Refresco programado | Circuit breaker tras 2 caídas seguidas. No empieza otro usuario si quedan menos de 10 s (`getRemainingTimeInMillis`) | No quemar la invocación contra un proveedor caído. Un éxito reinicia el contador |
| Claude | `timeout = min(TIMEOUT_LLM_MS, restante − 4 s)`, pasado por request al SDK. Con menos de 3 s ni se lo llama. Además, la promesa se corta en el plazo aunque el adaptador no lo haga | La respuesta tiene que llegar antes del corte de 30 s de API Gateway |

El tiempo restante sale del `context` de Lambda y llega a los casos de uso como una función `plazo()`.
Así el dominio y la aplicación no dependen de AWS.

### Motivos de falla

`ErrorServicioExterno` lleva un `motivo` (`timeout`, `no_disponible`, `limite`, `respuesta_invalida`,
`rechazo`, `sin_configuracion`) y el `servicio`. Los errores del SDK de Anthropic se clasifican por clase,
de la más específica a la más general: `APIConnectionTimeoutError` → `APIConnectionError` → 401/403 →
`RateLimitError` / 529 → resto. Hacia el frontend, `sin_configuracion` se expone como `sin_api_key`.

### Observabilidad

Cada caída deja una línea JSON `{"evento":"dependencia_caida","servicio","motivo","usuarioID","consecuencia","error"}`.
Dos `AWS::Logs::MetricFilter` la cuentan en `Medianube/CaidasOpenMeteo-<env>` y `Medianube/CaidasClaude-<env>`.
El patrón es de texto y no JSON porque el formato de log por defecto de Lambda antepone el timestamp y el `requestId`.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Mantener 502 cuando el clima no está disponible | Obliga al frontend a tratar como error algo esperable. El dato es accesorio: la pantalla puede mostrar "clima no disponible" |
| Reintentos del SDK de Anthropic (`maxRetries`) | Con 30 s de presupuesto, un reintento de una llamada de ~20 s no entra. Las reglas son el fallback |
| Circuit breaker persistente entre invocaciones (DynamoDB / ElastiCache) | Agrega estado e infraestructura. Con el volumen del MVP alcanza el breaker por corrida y la cache |
| Alarmas con SNS | Requieren un tópico y suscripciones. Quedan las métricas como base para agregarlas |

## Consecuencias

- **El frontend tiene que leer los campos nuevos:** `disponible` y `aviso` en `/clima`; `degradado`,
  `motivoDegradacion` y `guardado` en `/precios/sugerir`. Así puede marcar una sugerencia "calculada sin IA",
  de acuerdo con el principio de "honestidad en la incertidumbre" de `docs/UXUI/DESIGN.md`.
- `predecirDemanda` (rama `feat/Cronjob`) ya predice sin clima, con confianza degradada. Cuando se mergee
  conviene sumarle el mismo registro `dependencia_caida` y `respuestaError`.
- Faltan alarmas sobre las métricas y la prueba en AWS con una key inválida y Open-Meteo bloqueado.
