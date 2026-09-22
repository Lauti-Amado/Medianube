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


## 21/09/2026 - Provisionamiento de Infraestructura Cloud e Integración de Backend (AWS)
**Problema abordado:** Definición de la arquitectura inicial en AWS (S3, DynamoDB/RDS y Lambda), resolución del error de logs no encontrados (ResourceNotFoundException) al probar AWS Lambda, e identificación del flujo de creación de eventos de prueba en la consola.

**Prompt / Herramienta utilizada:** Asistente IA (Gemini). Prompts enviados: guía paso a paso para desplegar infraestructura y backend en AWS, consulta sobre cambio de región en S3, concepto de bucket, resolución de error de CloudWatch Logs (ResourceNotFoundException), e instrucciones para configurar eventos de prueba en Lambda.

**Código / Arquitectura generada:**

- Propuesta de creación de un bucket de AWS S3 privado para el almacenamiento de facturas.

- Configuración de base de datos DynamoDB On-Demand (o RDS Free Tier) para la persistencia de datos.

- Código base en Node.js para una función AWS Lambda de prueba que retorna un estado HTTP 200:

```json
{
  "statusCode": 200,
  "body": "¡Hola! La Lambda de prueba funciona correctamente."
}
```

- Pasos para configurar un evento de prueba hello-world en Lambda para activar la generación de logs.

**Validación y Corrección Humana:**

- **Análisis de arquitectura:** Se confirmó que la región de AWS S3 no se puede cambiar dinámicamente tras la creación y que requiere recrear el bucket si se desea migrar.

- **Resolución de errores de CloudWatch:** Se diagnosticó la ausencia del Log Group (ResourceNotFoundException), identificando que el evento de prueba de Lambda no se había ejecutado por falta de un Test Event predefinido y/o permisos IAM (AWSLambdaBasicExecutionRole).

- **Seguridad:** Se garantizó la activación de la opción Block All Public Access en el bucket S3 para prevenir la exposición pública de facturas confidenciales.


## 21/09/2026 - Frontend Cloud (despliegue en AWS EC2)

**Problema abordado:** Dejar el frontend Next.js de Medianube corriendo en una instancia EC2 (Ubuntu), accesible por HTTP, y documentar el redespliegue. Había que crear la instancia, instalar Node 22, Git, Nginx y PM2, buildear y no exponer la máquina a internet de más.

**Prompt / Herramienta utilizada:** Cursor (chat en modo Ask y luego Agent). Se pidió el plan de tareas al estilo del issue de Infra, el paso a paso de deploy manual, comandos de instalación/build/PM2/Nginx, y un `REDESPLEGAR.md` en esta carpeta.

**Código / Arquitectura generada:** Arquitectura simple Internet → Nginx (:80) → Next.js (:3000) con PM2. Propuesta de swap de 2 GB cuando `next build` terminaba en `Killed`. Config de Nginx como reverse proxy y secuencia `git pull` → `npm ci` → `npm run build` → `pm2 restart medianube`. No se usó Docker ni GitHub Actions en este despliegue.

**Validación y Corrección Humana:** Se comprobó en la EC2 real: el build falló por OOM y el swap lo resolvió; `nginx -t` sin sudo daba falso error de permisos (había que usar `sudo`). Se rechazó abrir 80/22 a `0.0.0.0/0`: quedaron solo desde la IP del operador. No se subieron `.pem` ni access keys. La IA insistió al inicio en IAM humano / Identity Center; en esta cuenta no aplica (IAM solo programático), y el trabajo de consola se hizo con root.