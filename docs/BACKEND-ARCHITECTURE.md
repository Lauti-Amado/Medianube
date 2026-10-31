# ADR: Arquitectura del backend (hexagonal, TypeScript, una Lambda por caso de uso)

**Estado:** Aceptada · **Fecha:** 29/10/2026 · **Rama:** `refactor/backend-hexagonal`

## Contexto

El backend empezó como una única Lambda (`obtenerClima`) en JavaScript plano. Se van a sumar
funciones con más lógica (motor de precios con LLM, procesamiento de facturas, predicción de
demanda), que dependen de servicios externos que pueden cambiar (proveedor de LLM, OCR, base de datos).
Hace falta una estructura mantenible que permita testear la lógica sin AWS y cambiar de proveedor
sin reescribir los casos de uso.

## Decisión

1. **Arquitectura hexagonal (puertos y adaptadores)** con cuatro capas:
   `domain` (reglas puras) ← `application` (casos de uso) ← `ports` (contratos) ← `adapters` (AWS, APIs externas).
   Las dependencias siempre apuntan hacia el dominio. Un único *composition root* por Lambda
   (`src/composition/`) lee variables de entorno y conecta adaptadores con casos de uso.
2. **Node.js plano, sin framework** (ni NestJS, ni Express). En Lambda cada función ya tiene un
   trigger y un handler; el routing y la inyección de dependencias de un framework son peso muerto
   y suman cold start. La inyección se hace con funciones fábrica (`crearServicioClima({ ... })`).
3. **Una Lambda por caso de uso**, con núcleo compartido. Se mantiene la elasticidad y la
   concurrencia reservada por función (control de gasto, FinOps).
4. **TypeScript estricto**, compilado con **esbuild** a un único bundle ESM por Lambda
   (`dist/<nombre>/index.mjs`). `tsc` solo verifica tipos (`noEmit`). El AWS SDK v3 queda como
   dependencia externa porque ya viene en el runtime de Lambda.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| NestJS / Express sobre Lambda | Pensados para un servidor siempre encendido; agregan cold start sin resolver un problema real. |
| Una sola Lambda con router interno | Pierde concurrencia reservada y escalado por función. |
| JavaScript con JSDoc | Los puertos y los contratos del LLM (schemas) se leen y verifican mucho mejor con tipos reales. |
| SAM / CDK | No hay SAM CLI instalado; CloudFormation + `aws cloudformation package` alcanza y se ejecuta desde CloudShell. |

## Consecuencias

- **Positivas:** los casos de uso se testean con *fakes* en memoria (sin AWS ni red); cambiar de
  proveedor (ej. de Open-Meteo a otro, o de LLM) es un adaptador nuevo; el compilador detecta
  contratos rotos entre capas.
- **Costos asumidos:** más archivos que una Lambda de un solo `index`; hay un paso de build
  (`npm run build`) antes de empaquetar; CloudShell necesita Node 22.
- **Refactor sin cambios de comportamiento:** `obtenerClima` migró con los mismos 28 tests
  (reubicados por capa), el mismo contrato de API y el mismo template.
