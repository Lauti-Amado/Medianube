# ☁️ Medianube

**SaaS Integral de Gestión Gastronómica Inteligente**

Proyecto desarrollado por: Amado Lautaro, Cáceres Juan, Figueira Julián, Piquet Leonel y Tundis Yamil.

## 📌 Sobre el Proyecto
Medianube es una solución integral en formato SaaS diseñada para dueños, administradores y encargados de producción en negocios gastronómicos. El sistema automatiza el día a día mediante Inteligencia Artificial: gestiona las compras analizando automáticamente las facturas, sugiere precios de venta para proteger la rentabilidad frente a la inflación y predice la demanda futura de producción.

*Para más detalles sobre el análisis del problema y nuestra propuesta, consultar el [One-Pager](docs/ONE-PAGER.md).*

## 🛠️ Arquitectura y Stack Tecnológico
El sistema está diseñado bajo un modelo Cloud-Native utilizando los siguientes servicios:
* **Frontend:** Desarrollo en **NextJS / React**, desplegado sobre infraestructura **AWS EC2**.
* **Capa de Red y Enrutamiento:** **Amazon API Gateway** (HTTP API implementada como proxy para gestionar CORS y evadir restricciones de red/SCP de Learner Labs).
* **Backend (Serverless):** AWS Lambda.
* **Base de Datos:** DynamoDB o Amazon RDS.
* **Storage:** AWS S3 (alojamiento de imágenes de facturas).
* **Autenticación:** Clerk, Auth0 o AWS Cognito.
* **IA (El diferenciador):** Amazon Textract u OpenAI Vision para el OCR de tickets, y modelos LLM (OpenAI/Claude) para el análisis de variables y predicción de demanda.

---

## ⚠️ Workflow y Reglas de Desarrollo (Higiene de Ingeniería)

Para garantizar la calidad técnica y cumplir con los criterios de evaluación de la UTN FRLP, este equipo adopta el siguiente flujo de trabajo:

### 1. Control de Versiones (Conventional Commits)
La evaluación de la materia es individual y se auditará la frecuencia y calidad en el historial de Git. Es obligatorio el uso del estándar *Conventional Commits*:
* `feat:` Para nuevas funcionalidades (ej. `feat: agrega formulario de login`).
* `fix:` Para corrección de errores (ej. `fix: error de conexion con dynamoDB`).
* `docs:` Para actualizaciones de documentación (ej. `docs: actualiza diagrama cloud`).
* *Nota estricta:* Se prohíben los "code drops" (subidas masivas de código a último momento).

### 2. Integración y Revisiones de Código
* La rama `main` se encuentra protegida. Está prohibido el push directo.
* Todo aporte debe integrarse mediante **Pull Requests**.
* Es obligatoria la revisión cruzada (Code Review) entre los integrantes antes de aprobar y fusionar el código.

### 3. Gestión de Tareas (Kanban)
* La planificación se ejecuta de forma transparente en GitHub Projects.
* Para prevenir cuellos de botella operativos, el equipo debe respetar un límite de **[WIP: 4]** en la columna de tareas en curso.
* **Convención de Tareas:** Todo ticket debe crearse utilizando el formato `[Módulo] Acción a realizar` (ej. `[Infra] Crear instancia EC2`) y tener siempre un responsable asignado ("Assignee").

### 4. Auditoría de Inteligencia Artificial (AI Policy)
El uso de asistentes está permitido, pero es nuestra responsabilidad determinar que está bien y que está mal, que sirve y que no.
* Todo fragmento de código, arquitectura o prompt generado con IA se va a registrar en el archivo `AI-DECISIONS.md` ubicado en la raíz del repositorio.
* Cada entrada debe justificar: el problema abordado, la herramienta empleada, la salida generada y la corrección manual aplicada.

### 5. Entregas y Releases
El código correspondiente a cada Checkpoint evaluativo se congela mediante Tags de Git y ramas específicas para facilitar la auditoría de la cátedra:
* **Checkpoint 1 (28/09):** Tag `v0.1-checkpoint-1` (Rama: `entrega/checkpoint-1`).

### 6. Convenciones de Arquitectura y Base de Datos
* **DynamoDB (Partition Keys):** Para garantizar la consistencia en todo el ecosistema Serverless y evitar deuda técnica al cruzar datos con los modelos de IA (RAG), el estándar para todas las tablas es utilizar `usuarioID` (String) como clave primaria. Quedan prohibidas variantes locales como `userId` o `id_usuario`.