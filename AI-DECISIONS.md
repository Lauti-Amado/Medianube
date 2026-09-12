# Registro de Decisiones de IA (AI Decision Log)

## [Fecha] - [Módulo o Tarea]
* **Problema abordado:** [Descripción del desafío técnico]
* **Prompt / Herramienta utilizada:** [Instrucción enviada y asistente empleado, ej: Cursor, Copilot]
* **Código / Arquitectura generada:** [Resumen de la propuesta de la IA]
* **Validación y Corrección Humana:** [Análisis crítico: corrección de alucinaciones, ineficiencias o riesgos de seguridad]


## 09/09/2026 - Análisis Arquitectónico: Descarte de Docker en Frontend y Backend

**Problema abordado:** Evaluación del modelo de cómputo para toda la aplicación. Se debatió si el equipo debía containerizar el proyecto (Docker) o utilizar servicios gestionados (Serverless/PaaS) para cumplir con las fechas del cuatrimestre y el objetivo de minimizar la carga operativa.

**Prompt / Herramienta utilizada:** Gemini.
*Prompt:* "Actúa como un Cloud Architect. Analiza si conviene usar Docker para el frontend (NextJS) y el backend de un SaaS gastronómico desarrollado por estudiantes, con un deadline estricto de 3 meses. El proyecto debe priorizar la IA como diferenciador. Evalúa carga operativa, costos y escalabilidad frente a opciones Serverless/PaaS."

**Código / Arquitectura generada:** La IA desaconsejó Docker para este contexto. Indicó que containerizar NextJS y la API requiere mantener registries, pipelines de CI/CD complejos y orquestadores, lo que desvía la atención del producto. Sugirió usar Serverless (Lambda) para el backend por su escalado a cero, y despliegue directo o PaaS para el frontend, reduciendo la barrera de infraestructura.

**Validación y Corrección Humana:** El equipo de ingeniería acepta la recomendación de la IA y decide **rechazar Docker en todas las capas del proyecto**. Esta decisión coincide con la exigencia de la cátedra de priorizar el tiempo de mercado (*Time-to-Market*) y el uso de servicios gestionados. Asumir la carga operativa de los contenedores pondría en riesgo la pre-entrega del 09/11 y la defensa del 30/11. El análisis completo y la comparativa técnica fueron documentados en `docs/DOCKER-VS-SERVERLESS.md`.
