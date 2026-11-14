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

## 22/09/2026 - Justificación Arquitectónica: Despliegue de Frontend (EC2 vs PaaS)

**Problema abordado:** Justificar la elección de infraestructura IaaS (AWS EC2) frente a las alternativas PaaS (Vercel / AWS Amplify) sugeridas por la cátedra para el despliegue del frontend en Next.js, mitigando el riesgo de penalización en la evaluación de la arquitectura.

**Prompt / Herramienta utilizada:** Gemini.
*Prompt:* "Actúa como Cloud Architect. Justifica técnicamente por qué un equipo elegiría AWS EC2 para desplegar un frontend en Next.js en lugar de usar Vercel, considerando que el objetivo es mantener todo el ecosistema (Lambda, S3, DynamoDB) centralizado en AWS y tener control total sobre el entorno."

**Código / Arquitectura generada:** La IA generó un documento ADR (Architecture Decision Record) argumentando que EC2 permite mayor soberanía de red (VPC), gestión unificada de políticas de seguridad y centralización de la infraestructura, evitando el vendor lock-in específico de las plataformas PaaS de terceros.

**Validación y Corrección Humana:** Se validó la argumentación de la IA y el equipo ratificó la decisión. Aunque la cátedra fomenta el uso de servicios gestionados (PaaS) para minimizar la carga operativa y maximizar el Time-to-Market, el equipo asume el *trade-off* operativo inicial de configurar y mantener manualmente Nginx y PM2 en EC2. Esta decisión se toma con el objetivo de garantizar que toda la arquitectura (frontend y backend) resida bajo el mismo proveedor (AWS) y red virtual. La justificación extendida se documentó formalmente en el archivo `docs/FRONTEND-DEPLOYMENT.md`.


## 22/09/2026 - Selección de Servicio de Autenticación (Cognito vs Auth0)

**Problema abordado:** El one-pager inicial dejaba la autenticación como una decisión 
abierta ("Auth0 o AWS Cognito"), sin resolver. Era necesario definir un único 
servicio gestionado de identidad, ya que de esta elección dependían tanto la configuración del backend (validación de tokens en Lambda) como el desarrollo de la UI de login en el frontend.

**Prompt / Herramienta utilizada:** Claude (Anthropic).
*Prompt:* "Actuá como Cloud Architect. Tenemos definido el stack de Medianube en AWS 
(EC2 para frontend, Lambda para backend serverless, S3 para storage, DynamoDB para persistencia). Necesitamos elegir un servicio gestionado de autenticación entre AWS Cognito y Auth0. Evaluá ambas opciones considerando coherencia con el resto de la arquitectura y facilidad de integración."

**Código / Arquitectura generada:** La IA recomendó **AWS Cognito** por sobre Auth0, 
fundamentando la elección en dos ejes: (1) coherencia de proveedor, dado que el resto 
del stack (EC2, Lambda, S3, DynamoDB) ya es 100% AWS, lo que permite integrar 
Cognito de forma nativa con el authorizer de API Gateway y con políticas IAM sin código 
adicional; (2) costos, señalando la capa gratuita de Cognito (~50.000 usuarios activos 
mensuales) como más generosa que la de Auth0 para un MVP académico. La IA también señaló los escenarios donde Auth0 sería preferible (estrategia multi-cloud, necesidad de login social avanzado out-of-the-box, o experiencia previa del equipo con esa herramienta), ninguno de los cuales aplica al contexto de MediaNube.

**Validación y Corrección Humana:** El equipo evaluó la recomendación contra los 
requisitos reales del proyecto y coincidió en que ni la estrategia multi-cloud ni el login 
social son necesidades de MediaNube en esta etapa del MVP. Se validó además que la 
integración propuesta (Cognito + API Gateway authorizer) es consistente con la decisión 
ya tomada de mantener EC2 y Lambda bajo el mismo proveedor. Se descartó Auth0 definitivamente y se definió AWS Cognito como el servicio de autenticación del proyecto, con dos puntos de integración: el frontend (login, obtención de token JWT) y el backend (validación de token en cada request).


## 26/09/2026 - Integración Frontend Next.js con AWS Cognito

**Problema abordado:** Conectar el frontend en Next.js (rama `integracion/infraestructura`) con el User Pool de Cognito ya provisionado, implementando el flujo completo de autenticación: registro de usuario, confirmación por email, inicio de sesión, protección de rutas y cierre de sesión. La pantalla de login existente solo hacía un `router.push("/dashboard")` sin validar credenciales reales.

**Prompt / Herramienta utilizada:** Antigravity IDE (Google Deepmind).
*Prompt:* "Queremos conectar el frontend con el servicio AWS Cognito para autenticar. Estas son las credenciales: User Pool ID: `us-east-2_kFlJZW7ar`, App Cliente ID: `7d6ucjtp7k0g3rt6dk42kmhajt`, Región: `us-east-2`. Haz un plan de implementación para conectar ambos servicios y dejarlo funcional."

**Código / Arquitectura generada:**

La IA propuso e implementó la siguiente arquitectura de autenticación cliente:

- **SDK elegido:** `amazon-cognito-identity-js` (instalado vía npm) en lugar de AWS Amplify completo, justificando menor bundle size (~50 KB vs ~400 KB) para el caso de uso específico.
- **`lib/cognito.ts`:** Singleton con la instancia de `CognitoUserPool` (User Pool ID + Client ID).
- **`lib/auth-context.tsx`:** React Context (`AuthProvider`) que expone `signIn`, `signUp`, `confirmSignUp` y `signOut`. Al montar, verifica si existe una sesión activa en `localStorage` (manejo nativo del SDK). Además, sincroniza el `idToken` JWT en una cookie (`cognitoIdToken`) para que el middleware de Next.js pueda leerla server-side.
- **`app/providers.tsx`:** Thin wrapper con `"use client"` para envolver el layout server component con el `AuthProvider`.
- **`middleware.ts`:** Middleware de Next.js que intercepta rutas protegidas (`/dashboard`, `/compras`, `/precios`, `/demanda`, `/configuracion`) y redirige a `/login` si no existe el token en cookies. Rutas públicas (`/login`, `/onboarding`) redirigen a `/dashboard` si ya hay sesión activa.
- **`app/login/page.tsx`:** Formulario conectado a `signIn()` con manejo de errores por código Cognito (`NotAuthorizedException`, `UserNotConfirmedException`, `UserNotFoundException`), estado de loading con spinner y soporte de parámetro `?redirect=` inyectado por el middleware.
- **`app/onboarding/page.tsx`:** Flujo extendido a 4 pasos: datos del negocio → credenciales + `signUp()` → confirmación de código OTP (6 dígitos) vía `confirmSignUp()` → resumen + auto-login con `signIn()` y redirección al dashboard.
- **`Sidebar.tsx`:** Botón de "Cerrar sesión" convertido de `<Link>` a `<button>` que invoca `signOut()` del contexto y luego `router.push("/login")`.

**Validación y Corrección Humana:**

- **Atributos custom en Cognito:** La IA generó el `signUp()` incluyendo atributos `custom:businessName` y `custom:businessType`. Al probarlo, Cognito devolvió el error: *"Attributes did not conform to the schema: Type for attribute {custom:businessName} could not be determined"*. El User Pool no tenía esos atributos custom definidos en su schema. Se corrigió eliminando dichos atributos del payload de registro; el nombre y tipo de negocio se almacenarán en la base de datos de la app cuando el backend esté disponible.
- **Protección dual de rutas:** Se validó que la protección por middleware (server-side, sobre cookie) y por `AuthContext` (client-side, sobre estado React) son complementarias y necesarias: el middleware evita el flash de contenido protegido, mientras el contexto gestiona el estado reactivo en navegación SPA.
- **Separación `providers.tsx`:** El layout raíz (`layout.tsx`) es un Server Component en Next.js 15 y no puede importar directamente el `AuthProvider` (que usa hooks). La IA resolvió esto correctamente con el wrapper `"use client"`, sin necesitar convertir todo el layout a client component.
- **Build verificado:** El proyecto compiló sin errores de TypeScript (`next build` exit code 0, 13 rutas generadas estáticamente, middleware 34.1 kB).

## 04/10/2026 - Unificación de Partition Keys en DynamoDB
**Problema abordado:** Inconsistencia en el diseño NoSQL. Una tabla usaba `usuarioID` y otra `userId`, generando deuda técnica para futuros cruces de datos con IA (RAG).
**Prompt / Herramienta utilizada:** Análisis manual de arquitectura sugerido por Gemini.
**Código / Arquitectura generada:** Regeneración manual de la tabla `Medianube-Configuracion` en AWS DynamoDB.
**Validación y Corrección Humana:** Se eliminó la tabla con la clave incorrecta y se volvió a aprovisionar utilizando el estándar `usuarioID` (String) para mantener una convención estricta.

## 04/10/2026 - Estrategia FinOps en Function URL Pública (Onboarding)
**Problema abordado:** Exponer la Lambda `guardarConfiguracionOnboarding` al frontend local (AuthType: NONE) sin arriesgar el presupuesto ante un Denial of Wallet.
**Prompt / Herramienta utilizada:** Análisis de límites defensivos (Guardrails) con Gemini.
**Código / Arquitectura generada:** Function URL pública con límite estricto de Concurrencia Reservada = 2.
**Validación y Corrección Humana:** Actúa como "Circuit Breaker" financiero, permitiendo el desarrollo sin fricción pero garantizando matemáticamente que la función no escalará masivamente ante picos anómalos.

## 04/10/2026 - Bypass de Service Control Policies (SCP) con API Gateway
**Problema abordado:** AWS Academy (Learner Labs) bloqueaba sistemáticamente la Function URL pública (HTTP 403) debido a SCPs organizacionales, pese a tener la política IAM en "Principal": "*".
**Prompt / Herramienta utilizada:** Cloud Debugging con Gemini.
**Código / Arquitectura generada:** Implementación del patrón Amazon API Gateway (HTTP API) como proxy inverso frente a Lambda.
**Validación y Corrección Humana:** Rediseño alineado a topologías de producción. Se delegó el manejo de CORS y el enrutamiento público a API Gateway, superando el bloqueo de seguridad del entorno.

## 18/10/2026 - Aprovisionamiento de tablas DynamoDB (IaC) y Lambda de Clima

**Problema abordado:** Faltaba aprovisionar la capa de datos para facturas, productos, ventas y predicciones, y una función que traiga el pronóstico del clima (una variable del modelo de predicción de demanda, según el one-pager). Hasta ahora toda la infraestructura se creaba a mano en la consola, sin trazabilidad en el repositorio.

**Prompt / Herramienta utilizada:** Antigravity IDE (Google Deepmind).
*Prompt:* "Actúa como un ingeniero de software experto en desarrollo full stack, necesito aprovisionar las tablas en DynamoDB/RDS y armar la función lambda que consume la API del clima. Haz un plan de ejecución para dicha tarea."

**Código / Arquitectura generada:**

- **ADR `docs/DATABASE-DECISION.md`:** DynamoDB On-Demand sobre RDS. Con RDS la Lambda tendría que vivir en una VPC y necesitaría un NAT Gateway (~USD 32/mes) para llegar a la API del clima.
- **`backend/infra/template.yaml` (CloudFormation):** 5 tablas con clave compuesta `usuarioID` + SK (`Facturas`, `Productos`, `Ventas`, `Predicciones`, `Clima`), TTL en Clima/Predicciones, `DeletionPolicy: Retain` en las tablas de negocio. Lambda `obtenerClima` (Node 20, arm64, concurrencia reservada 2), ruta `GET /clima` agregada a la HTTP API existente, authorizer JWT de Cognito opcional y regla de EventBridge diaria a las 05:00 ART.
- **Lambda `obtenerClima`:** consume **Open-Meteo** (gratis, sin API key → no hay secretos que gestionar). Usa estrategia cache-first (6 h) en `Medianube-Clima`; si la API falla, devuelve la última cache marcada como `desactualizado`. La lógica está desacoplada del AWS SDK por inyección de dependencias y tiene 28 tests unitarios con `node:test`.

**Validación y Corrección Humana:**

- **Clave de `Medianube-Clima`:** la IA planteó que el clima depende de la ubicación y no del usuario. El equipo decidió mantener la clave compuesta `usuarioID` + `fecha` para respetar la convención del README, aceptando que se dupliquen datos de usuarios de la misma ciudad.
- **Herramientas disponibles:** el equipo no tiene AWS CLI ni SAM CLI instalados. Se descartó SAM y se usó CloudFormation puro, desplegable desde AWS CloudShell con `aws cloudformation package/deploy`.
- **Restricciones de AWS Academy:** como no se pueden crear roles IAM, el template recibe un `RolLambdaArn` opcional (`LabRole`). Se eligió una regla clásica de EventBridge en lugar de EventBridge Scheduler porque esta última requiere un rol propio.
- **Autenticación:** el equipo no tenía confirmado si existía un authorizer JWT en API Gateway. Se dejó un parámetro `ModoAutenticacion` (`dev` acepta `?usuarioID=`, `jwt` valida el token de Cognito). La Lambda siempre prioriza el claim `sub` por sobre el query string, para evitar suplantación cuando se active `jwt`.
- **Fechas:** se verificó por test que el "hoy" se calcule en la zona horaria de Argentina (a las 23:30 ART ya es el día siguiente en UTC).
- **Prueba real:** se validó la normalización contra la API real de Open-Meteo para La Plata (7 días con códigos WMO traducidos al español).
- **Riesgo detectado:** si `guardarConfiguracionOnboarding` usa `PutItem`, va a borrar el atributo `ubicacion`. Hay que migrarla a `UpdateItem`.
- **Runtime deprecado:** la IA propuso primero `nodejs20.x`. Al validar el template con `cfn-lint` apareció el aviso W2531 (runtime deprecado desde el 30/04/2026) y se pasó a `nodejs22.x`, alineado con la versión local del equipo.



## 23/10/2026 - Motor OCR: trigger de S3 hacia AWS Lambda y Amazon Textract

**Problema abordado:** Procesar automáticamente cada factura subida desde la vista `app/compras/subir`, sin intervención del usuario, para extraer sus datos (proveedor, fecha, total e ítems). Las facturas ya se alojaban en S3 mediante Presigned URLs, pero nada reaccionaba a la subida.

**Prompt / Herramienta utilizada:** Claude (Anthropic).
*Prompt:* "Soy la Persona 3 del proyecto. Mi tarea es configurar un trigger de S3 para enviar la factura a Amazon Textract o IA Vision y extraer el texto. ¿Cómo sigo?", seguido de consultas paso a paso sobre la consola de AWS (permisos del rol, timeout, configuración del desencadenador y lectura de logs en CloudWatch).

**Código / Arquitectura generada:**

- Arquitectura orientada a eventos: S3 Event Notification (`Todos los eventos de creación de objetos`, prefijo de facturas) → Lambda `procesarFactura` (Node.js) → Amazon Textract.
- Uso de la API `AnalyzeExpense` en lugar de `DetectDocumentText`, porque devuelve los campos de la factura ya etiquetados (`VENDOR_NAME`, `INVOICE_RECEIPT_DATE`, `TOTAL`) y los ítems en `LineItemGroups`, en vez de texto plano.
- Código de la Lambda que toma el bucket y la key del evento (decodificando la key), llama a Textract, normaliza la respuesta a un JSON con proveedor, fecha, total e ítems, y maneja errores por factura con `try/catch` para que un archivo defectuoso no corte el procesamiento.
- Ajuste del timeout de la Lambda de 3 a 30 segundos.

**Validación y Corrección Humana:**

- **Prueba incremental:** antes de integrar Textract se desplegó una versión que solo logueaba el evento recibido (`console.log(JSON.stringify(event))`), y se verificó en CloudWatch que S3 disparaba la Lambda con el bucket y la key correctos.
- **Permisos:** se revisó el rol de ejecución (`PowerUser-lambda-4`) y se confirmó que ya tenía `PowerUserAccess`, por lo que no fue necesario agregar las políticas de Textract y S3 que la IA había propuesto inicialmente.
- **Invocación recursiva:** se aceptó la advertencia de AWS dejando como regla que la Lambda nunca escriba archivos en el mismo prefijo que la dispara, para evitar un loop de ejecuciones.
- **Limitación detectada:** la versión sincrónica de `AnalyzeExpense` solo admite PDF de una página; los documentos de varias páginas requieren la API asincrónica (`StartExpenseAnalysis`).


## 23/10/2026 - Diagnóstico del bloqueo de Amazon Textract (AccessDeniedException por SCP)

**Problema abordado:** Al probar el motor OCR, la Lambda fallaba con `AccessDeniedException`: el rol no estaba autorizado a ejecutar `textract:AnalyzeExpense` por un *explicit deny* en una Service Control Policy. El trigger, el código y los permisos IAM eran correctos.

**Prompt / Herramienta utilizada:** Claude (Anthropic), con búsqueda web sobre la documentación de AWS. Se le enviaron los logs completos de CloudWatch y una captura de la página de inicio de la consola, preguntando el origen del bloqueo y cómo verificarlo.

**Código / Arquitectura generada:** La IA explicó que un *explicit deny* en una SCP se define a nivel de organización y prevalece sobre cualquier política IAM (incluida `PowerUserAccess`), por lo que no se resuelve modificando el rol. Con la documentación de AWS identificó la causa: la cuenta usa la nueva experiencia de AWS (proyectos y equipo) con plan gratuito, en la que Textract no está habilitado salvo que se activen las "características avanzadas". Según AWS, las cuentas con plan gratuito pasan automáticamente al plan pago al unirse a AWS Organizations.

**Validación y Corrección Humana:**

- **Diagnósticos erróneos de la IA:** la IA concluyó primero que la cuenta no pertenecía a ninguna organización, lo que contradecía el ARN de la SCP presente en los logs (una organización administrada desde otra cuenta). Después supuso que el acceso a AWS era una plataforma de terceros; la captura de la consola demostró que era AWS oficial, con "Medianube" como proyecto. Ambas conclusiones se descartaron contrastándolas con la evidencia real (logs, URL y pantallas de la consola).
- **Rechazo de activar características avanzadas:** el asistente de AWS para activarlas pedía crear un equipo y una nueva cuenta de administración con otro correo. Se decidió no hacerlo, porque implicaba reorganizar la cuenta del proyecto, probablemente pasar al plan pago (con riesgo de costos fuera de los créditos) y era un cambio difícil de revertir para una tarea puntual.
- **Conclusión:** se confirmó en "Facturación y administración de costos" que la cuenta está en plan gratuito, y se descartó Textract como motor OCR.


## 23/10/2026 - Reemplazo de Amazon Textract por un LLM con visión (Gemini)

**Problema abordado:** Con Textract bloqueado, había que elegir otro motor OCR que funcionara bien con facturas y no generara costos ni requiriera cambiar el plan de la cuenta de AWS.

**Prompt / Herramienta utilizada:** Claude (Anthropic).
*Prompts:* "¿Qué alternativa proponés?", "¿Hay que pagar para usar un LLM con visión?" y "Quiero algo que funcione bien y sea gratis".

**Código / Arquitectura generada:** La IA comparó cuatro alternativas:

- **Amazon Bedrock** (Nova o Claude): quedaría dentro de AWS y sin API key, pero su disponibilidad en el plan gratuito solo estaba respaldada por una fuente de la comunidad, no oficial.
- **Amazon Rekognition:** descartado, porque está pensado para detectar texto en fotos y carteles, no para leer facturas completas.
- **APIs pagas** (OpenAI, Anthropic): requieren tarjeta y saldo; la suscripción a los chats no incluye la API.
- **Gemini** de Google, nivel gratuito de Google AI Studio: sin tarjeta, admite imágenes y PDF de varias páginas, y no depende de las restricciones de la cuenta de AWS.

Recomendó Gemini, manteniendo intacta la arquitectura (trigger de S3, Lambda y permisos) y cambiando solo la parte del código que llama al motor OCR.

**Validación y Corrección Humana:**

- **Alineación con la planificación:** se verificó que la tarea original permitía "Amazon Textract o IA Vision", y que la tarea de la semana 3 ya mencionaba el "JSON estructurado devuelto por la IA de Visión", por lo que el cambio no altera el alcance.
- **Gestión del secreto:** la API key se guardó como variable de entorno de la Lambda (`GEMINI_API_KEY`) y no se escribe en el código ni se sube al repositorio.
- **Privacidad:** se tuvo en cuenta que, en el nivel gratuito, Google puede usar los datos enviados para mejorar sus modelos. Se aceptó para facturas de prueba, y queda señalado como punto a revisar antes de procesar facturas reales de clientes.


## 23/10/2026 - Integración con la API de Gemini y diseño del prompt de extracción

**Problema abordado:** Implementar la llamada a Gemini desde la Lambda y diseñar un prompt que devuelva datos de facturas en un formato estable y apto para guardar en la base de datos.

**Prompt / Herramienta utilizada:** Claude (Anthropic), con los logs de CloudWatch de cada prueba.

**Código / Arquitectura generada:**

- La Lambda descarga la factura de S3 (`GetObject`), la convierte a base64 y la envía a la API `generateContent` de Gemini junto con el prompt, detectando el tipo de archivo por la extensión (PDF, PNG, JPG, WEBP).
- Prompt de extracción con un esquema JSON fijo (proveedor, CUIT, número de factura, fecha `AAAA-MM-DD`, total, moneda e ítems), números sin símbolos ni separadores de miles, y la instrucción explícita de devolver `null` ante datos ausentes y no inventar información.
- Configuración `responseMimeType: "application/json"` y `temperature: 0`, para obtener JSON válido y respuestas deterministas.

**Validación y Corrección Humana:**

- **API key inválida (400 `API_KEY_INVALID`):** se resolvió volviendo a copiar la clave desde Google AI Studio en la variable de entorno.
- **Timeout:** la Lambda llegaba al límite de 30 s con 111 de 128 MB de memoria. Se subió la memoria a 512 MB y el timeout a 90 s.
- **Saturación del modelo (503 `UNAVAILABLE`):** el modelo inicial (`gemini-flash-latest`) rechazaba los pedidos por alta demanda. Se cambió a `gemini-flash-lite-latest`, que respondió en 1,5 s.
- **Verificación de la extracción:** con una factura de prueba se comprobaron las cuentas (25 × 254,62 = 6.365,50 y 25 × 9 = 225) y que el total coincidía con el subtotal más un 21% de impuestos. El CUIT vino en `null` porque la factura era extranjera: el modelo no inventó el dato.
- **Pendiente:** validar la extracción con facturas argentinas reales.


## 23/10/2026 - Persistencia del resultado del OCR en DynamoDB

**Problema abordado:** Guardar el JSON devuelto por Gemini en DynamoDB de forma que el historial de compras (Lambda `listarGastos` y su pantalla) lo muestre sin modificaciones.

**Prompt / Herramienta utilizada:** Claude (Anthropic). Se le pasaron los atributos reales de la tabla `Gastos` (clave de partición `gastoID` y campos `categoria`, `fecha`, `monto`, `proveedor` y `usuarioID`), pidiendo guardar el resultado del OCR respetando ese esquema.

**Código / Arquitectura generada:**

- Mapeo del JSON de Gemini al esquema existente: `gastoID` generado con `randomUUID()` (prefijo `g-`), `monto` = total de la factura, `fecha` y `proveedor` directos, y `usuarioID` tomado del segmento de usuario de la key de S3 (`facturas/<usuario>/...`).
- Nuevo campo `categoria` en el prompt: una palabra en minúscula que describe el producto principal (por ejemplo, `harina`), para mantener la convención de los datos existentes.
- Atributos adicionales que DynamoDB admite por no tener esquema fijo: `moneda`, `numeroFactura`, `cuitProveedor`, `items` y `archivoS3`, este último con la ruta del archivo original en el bucket.
- Escritura con `PutCommand` del `DynamoDBDocumentClient`, con el nombre de la tabla en una variable de entorno (`TABLA_GASTOS`).

**Validación y Corrección Humana:**

- **Compatibilidad:** se priorizó respetar el esquema que ya consumía el historial (Persona 1 y Persona 2) en lugar de crear una estructura nueva, para no romper funcionalidades existentes.
- **Prueba de punta a punta:** se subió una factura desde el frontend y se verificó la fila nueva en DynamoDB con los datos extraídos.
- **Trazabilidad:** el campo `archivoS3` vincula cada gasto con su comprobante original, lo que permite agregar a futuro una opción para ver la factura desde el historial.
- **Pendiente:** el segmento de usuario de la key de S3 hoy es `anon`; cuando la subida use el usuario autenticado en Cognito, `usuarioID` va a quedar asociado al usuario real sin cambios en la Lambda.

## 24/10/2026 - Corrección de la configuración de ESLint del frontend

**Problema abordado:** `npm run lint` fallaba con "Cannot find module eslint-config-next/core-web-vitals" porque `eslint.config.mjs` estaba escrito para eslint-config-next 16 y el proyecto usa la versión 15.

**Prompt / Herramienta utilizada:** Claude (Anthropic). Prompt: error completo de lint y package.json, pidiendo la corrección sin actualizar dependencias.

**Código / Arquitectura generada:** eslint.config.mjs con FlatCompat extendiendo next/core-web-vitals y next/typescript.

**Validación y Corrección Humana:** Se confirmó con `npm ls` que el proyecto usa eslint-config-next 15.5.25 y que la config estaba escrita para la versión 16. Tras el fix, el lint corre y devuelve 0 errores y 2 warnings. Se corrigió el warning de variable sin usar en StepIndicator y se dejó el warning de fuentes en layout.tsx, porque en App Router la carga de Material Symbols por <link> funciona correctamente y cambiarla excede el alcance del ticket.

## 29/10/2026 - Arquitectura hexagonal en TypeScript para el backend (refactor de `obtenerClima`)

**Problema abordado:** Antes de sumar el motor de precios con LLM, había que definir una arquitectura de backend mantenible y escalable. La única Lambda existente (`obtenerClima`) estaba en JavaScript plano y mezclaba, en pocos archivos, lógica de negocio, acceso a DynamoDB y parsing de eventos de AWS.

**Prompt / Herramienta utilizada:** Antigravity IDE (Google Deepmind).
*Prompt:* "Necesito saber qué arquitectura usar para el backend, pensé en una arquitectura hexagonal que sea mantenible y escalable, usando algún framework como Node.js para luego aplicar cómputo serverless mediante funciones (AWS Lambda) para garantizar elasticidad. ¿Qué me recomiendas hacer?"

**Código / Arquitectura generada:**

- **Arquitectura hexagonal sin framework:** capas `domain ← application ← ports ← adapters` con un *composition root* por Lambda. Una Lambda por caso de uso con núcleo compartido. Documentado en `docs/BACKEND-ARCHITECTURE.md`.
- **Migración a TypeScript estricto** con bundle de esbuild por Lambda (`dist/<nombre>/index.mjs`) y `tsc --noEmit` solo para verificar tipos.
- **Refactor de `obtenerClima`:** el servicio quedó dependiendo únicamente de los puertos `ClimaRepositorioPort`, `PronosticoPort` y `LoggerPort`; DynamoDB y Open-Meteo pasaron a ser adaptadores de salida, y el handler de Lambda un adaptador de entrada.

**Validación y Corrección Humana:**

- **Framework descartado:** el equipo pidió evaluar un framework de Node.js. La IA recomendó no usar NestJS ni Express, porque en Lambda cada función ya tiene un trigger y un handler, y el framework solo agregaría cold start. El equipo aceptó mantener Node.js plano con inyección de dependencias por funciones.
- **TypeScript (decisión del equipo):** la IA ofreció mantener JS con JSDoc; el equipo eligió migrar a TypeScript para alinearse con el frontend, aceptando el costo de un paso de build.
- **Refactor sin cambio de comportamiento:** los 28 tests existentes se migraron a TypeScript separados por capa y siguen pasando; `tsc` no reporta errores. Se verificó que el bundle compilado carga y responde `401` ante un evento sin identidad, y que `cfn-lint` sigue sin errores.
- **Cambios de infraestructura:** el campo `Code` de la Lambda en `template.yaml` pasó a apuntar a `dist/obtenerClima` y `deploy.sh` ahora corre `npm ci`, `npm run check` y `npm run build` antes de empaquetar.
- **Riesgo conocido:** CloudShell puede traer una versión de Node distinta de la 22 y el build lo requiere. Se documentó `nvm install 22` en el README del backend.

## 31/10/2026 - Motor de precios con LLM (`POST /precios/sugerir`)

**Problema abordado:** Diseñar el prompt que compara el ticket extraído de una factura con el historial de compras para sugerir nuevos precios de venta, y la lógica de precios que lo rodea: emparejamiento de insumos, costos por receta, límites de margen y suba, y respuesta ante fallas del LLM.

**Prompt / Herramienta utilizada:** Claude Code (Claude Opus 5.5).
*Prompt:* "Necesito realizar una feature en la rama motor-precios que diseñe el prompt LLM que compare el ticket extraído con el historial para sugerir nuevos precios de venta, cubriendo básicamente la lógica de precios. Haz un plan de ejecución para dicha tarea." Primero se pidió y aprobó un plan; después se implementó en commits chicos.

**Código / Arquitectura generada:**

- **Dominio de precios** (`backend/src/domain/precios/`): normalización de presentaciones a precio por kg/l/u, emparejamiento de insumos por similitud de nombres, resumen del historial, costo por receta, guardas (margen mínimo, tope de suba, redondeo ARS) y nivel de confianza.
- **Caso de uso** `servicioPrecios`: le pasa al LLM los números ya calculados, sanea la respuesta, aplica guardas y, si el LLM falla, responde con reglas (`origen: "reglas"`).
- **Prompt versionado** `precios-v1` y adaptador de Claude: salida JSON con *structured outputs*, `fallbacks: "default"`, manejo de `stop_reason` y protección contra inyección desde el OCR.
- **Infraestructura:** Lambda `sugerirPrecios`, ruta `POST /precios/sugerir`, parámetro `ClaudeApiKey` (NoEcho), seed de demo y ADR en `docs/MOTOR-PRECIOS.md`.

**Validación y Corrección Humana:**

- **Decisiones del equipo:** partir de la última versión de `main` (backend hexagonal), usar la API de Claude directa en lugar de Bedrock (bloqueado en Learner Lab) y limitar el alcance a backend + endpoint; el frontend queda con mocks para otra tarea.
- **Correcciones sobre el plan inicial de la IA:** el plan proponía llamar a la API con `fetch`, usar `claude-sonnet-5-5` y forzar `tool_choice` con `temperature: 0`. Al contrastarlo con la documentación vigente de la API se cambió a: SDK oficial, `claude-opus-5-5` configurable, *structured outputs* (el `tool_choice` forzado y `temperature` devuelven 400 en los modelos actuales) y `effort` explícito.
- **Modelo de datos:** se detectó que sin recetas no se puede pasar del costo de un insumo al de un producto. Se agregó `receta` a `Medianube-Productos`, y los productos sin receta se informan en lugar de inventarles un costo.
- **El LLM no tiene la última palabra:** sus precios pasan por guardas determinísticas y su confianza nunca supera la que permite la evidencia (historial y receta), de acuerdo con el principio de "honestidad en la incertidumbre" de `docs/UXUI/DESIGN.md`.
- **Pruebas:** 80 tests (dominio, caso de uso, prompt y adaptadores con un cliente falso), `tsc` sin errores, bundle verificado en Node 22 y una corrida completa sin AWS con los datos del seed: el detergente no se empareja y "harina 000" no se confunde con "harina 0000".
- **Pendiente de validar por el equipo:** probar contra la API real con facturas reales (calidad de emparejamientos y justificaciones), confirmar qué tabla y qué atributos usa `listarGastos` para las facturas, y mover la API key a SSM Parameter Store antes de producción.


## 31/10/2026 - Filtros y búsqueda en la Lambda `listarGastos`

**Problema abordado:** La Lambda del historial devolvía siempre todos los gastos, sin orden y leyendo una sola página del `Scan` (hasta 1 MB). Había que permitir búsquedas por proveedor y rango de fechas sin romper la pantalla que ya la consumía.

**Prompt / Herramienta utilizada:** Claude (Anthropic). Se le pasó el código original de `listarGastos` y la tarea de la planificación: "Modificar la Lambda de historial para permitir búsquedas por fecha/proveedor y conectarlo a la UI de compras".

**Código / Arquitectura generada:**

- Lectura de filtros opcionales desde `queryStringParameters`: `proveedor`, `desde` y `hasta`.
- Validación de las fechas con una expresión regular (`AAAA-MM-DD`), respondiendo `400` con un mensaje de error si el formato es inválido.
- `Scan` paginado con `LastEvaluatedKey` / `ExclusiveStartKey` para leer la tabla completa.
- Filtrado en memoria: búsqueda parcial de proveedor sin distinguir mayúsculas y rango de fechas por comparación de strings (válida por el formato ISO).
- Orden de los resultados del más nuevo al más viejo.
- Mismo formato de respuesta (`{ gastos, count }`), con `count` igual a la cantidad de resultados filtrados.

**Validación y Corrección Humana:**

- **Scan frente a Query con GSI:** se evaluó rediseñar la tabla con un índice secundario por proveedor y fecha. Se eligió `Scan` con filtrado en memoria por ser suficiente para el volumen de datos del MVP y no requerir cambios en la tabla. Queda como deuda técnica migrar a `Query` con GSI si la tabla crece.
- **Nombre de la tabla:** la IA propuso pasarlo a una variable de entorno; se decidió mantener `"Gastos"` fijo, como en el código original de Persona 1.
- **Posible error de tabla detectado por la IA:** la IA advirtió una posible diferencia entre `Gastos` y `gastos`. Se verificó que existe una sola tabla (`Gastos`), y que estaba vacía porque sus registros de ejemplo habían sido borrados.
- **Datos de prueba:** se cargaron 4 gastos desde la consola de DynamoDB. La consola rechazaba el JSON común con el editor en modo "JSON de DynamoDB", y se resolvió usando el formato tipado (`{"S": ...}`, `{"N": ...}`).
- **Pruebas:** se ejecutaron 5 eventos de prueba en la consola (sin filtros, por proveedor, desde una fecha, por rango y con una fecha mal escrita) y todos devolvieron lo esperado, incluido el `400`.
- **Compatibilidad hacia atrás:** sin filtros, la respuesta conserva el formato original, por lo que la pantalla existente sigue funcionando sin cambios.


## 31/10/2026 - Integración de los filtros en el frontend y separación de correcciones de lint

**Problema abordado:** Agregar los filtros de proveedor y fechas a la pantalla del historial de compras, conectándolos con el endpoint de `listarGastos`.

**Prompt / Herramienta utilizada:** Claude Code (Anthropic), ejecutado sobre el repositorio en la rama `feature/filtros-historial`.
*Prompt:* "Necesito agregar filtros de búsqueda a la pantalla del historial de compras. El endpoint acepta proveedor (búsqueda parcial), desde y hasta (AAAA-MM-DD) y responde 400 si la fecha es inválida. Quiero un campo de proveedor, dos campos de fecha, botones Buscar y Limpiar, validación de que Desde no sea posterior a Hasta y estados de carga, error y sin resultados. Reutilizá la URL y la lógica de fetch existentes, respetá el estilo de la UI, no cambies cómo se renderiza la lista y no hagas commits. Primero explicame qué vas a cambiar; al final corré lint y build."

**Código / Arquitectura generada:**

- Antes de editar, la IA detectó que `frontend/app/compras/page.tsx` no llamaba a ningún endpoint: mostraba una constante `INVOICES` escrita a mano. El `fetch` a `/compras` existía solo en la rama `feat/historial-compras-front`, que no estaba integrada, y propuso tres formas de traerlo.
- Función `buscarGastos(filtros)` que arma los parámetros con `URLSearchParams` (solo los filtros completos) y propaga el mensaje de error del `400`.
- Componente nuevo `app/compras/FiltrosHistorial.tsx` con los campos Proveedor, Desde y Hasta, botones Buscar y Limpiar, búsqueda con Enter y validación del rango de fechas.
- Estados de carga, error y "No se encontraron compras con esos filtros" en `page.tsx`, sin cambiar el renderizado de las filas.

**Validación y Corrección Humana:**

- **Dependencia con otra rama:** se integró el trabajo de la rama del historial antes de agregar los filtros, en lugar de reescribir el fetch desde cero, para no duplicar código ni generar conflictos.
- **Errores de lint previos:** la IA corrió el lint antes de hacer cambios para distinguir errores existentes de nuevos. El build fallaba por dos `any` ajenos a la tarea, en `app/dashboard/page.tsx` y `app/demanda/page.tsx`. Se rechazó corregirlos dentro del PR de filtros para que este contenga solo la funcionalidad. La corrección se hizo en una rama aparte (`fix/frontend-lint-any`), creada desde `main` en un *git worktree*, para no afectar cambios sin commitear de la rama de filtros.
- **Prevención de conflictos:** los `any` de `app/compras/page.tsx` se corrigieron solo en la rama de filtros, porque esas líneas ya se modificaban ahí; corregirlos también en la rama de fix habría generado conflictos al mergear.
- **Verificación:** los archivos nuevos pasaron el lint y el chequeo de tipos (`tsc`), y la funcionalidad se probó manualmente en el navegador contra el backend real (búsqueda por proveedor, por rango de fechas, rango inválido y limpieza de filtros) antes de abrir el Pull Request.

## 01/11/2026 - Manejo de errores del backend ante caídas de Open-Meteo y Claude

**Problema abordado:** Validar que las Lambdas no fallen cuando no responden la API del clima (Open-Meteo) o el LLM (Claude). Al revisar el código se encontraron estos huecos:
- `GET /clima` respondía 502 sin cache.
- El refresco programado podía cortarse por timeout con Open-Meteo caído.
- El LLM tenía un timeout fijo que podía superar el corte de API Gateway.
- Una falla al guardar las sugerencias convertía en 500 una respuesta ya calculada.

**Prompt / Herramienta utilizada:** Claude Code (Claude Opus 5.5).
*Prompt:* "Necesito realizar otra feature en una rama nueva: manejo de errores del back, se debe validar en las lambdas que la aplicación no falle si la API del clima o el modelo LLM no responden." Primero se pidió y aprobó un plan; después se implementó en la rama `feat/manejo-errores` en commits chicos.

**Código / Arquitectura generada:**

- **Errores con motivo:** `ErrorServicioExterno` lleva `motivo` y `servicio`. Se agregaron helpers HTTP (`respuestaError`: 500 con `requestId` o 503 con `Retry-After` por throttling; `plazoDe`: tiempo restante de la Lambda) y un registro uniforme `dependencia_caida`.
- **Clima:**
  - respuesta 200 degradada (`disponible: false`) en lugar de 502;
  - un reintento en Open-Meteo solo ante errores transitorios;
  - un 200 sin días cuenta como falla;
  - circuit breaker y plazo en el refresco programado;
  - Lambda de 20 s.
- **Precios:**
  - timeout del LLM acotado al tiempo restante, con una red de seguridad propia;
  - clasificación de los errores del SDK por clase;
  - `degradado`, `motivoDegradacion` y `guardado` en la respuesta;
  - un guardado que falla ya no da 500.
- **Infraestructura:** filtros de métricas `CaidasOpenMeteo` y `CaidasClaude`. ADR en `docs/MANEJO-ERRORES.md`.

**Validación y Corrección Humana:**

- **Decisiones del equipo:**
  - con el clima caído y sin cache se responde 200 degradado y no 502;
  - la rama sale de `main` y no de `feat/Cronjob`, porque `predecirDemanda` ya predice sin clima;
  - la rama se llama `feat/manejo-errores`.
- **Verificado contra la documentación:** las clases de error del SDK de Anthropic (`APIConnectionTimeoutError` hereda de `APIConnectionError`) y el timeout por request (`create(params, { timeout })`) se confirmaron en el skill de la API y en las definiciones del SDK instalado, sin suponerlos.
- **Pruebas:** 109 tests, con fakes que simulan timeouts, 429/5xx, JSON roto, un LLM que nunca responde y throttling de DynamoDB. `tsc` sin errores y template validado. Además, una prueba de caos local con los adaptadores reales contra un puerto cerrado y un servidor que nunca responde: siempre 200 (clima degradado; precios por reglas en el plazo asignado), con el refresco cortado por el circuit breaker.
- **Pendiente de validar por el equipo:** la prueba en AWS (key inválida y Open-Meteo bloqueado), que el frontend lea los campos nuevos, alarmas sobre las métricas y aplicar el mismo criterio a `predecirDemanda` cuando se mergee `feat/Cronjob`.


## 01/11/2026 - Predicción de demanda nocturna con EventBridge (`predecirDemanda`)

**Problema abordado:** Configurar Amazon EventBridge para que el modelo predictivo de demanda corra solo todas las madrugadas. Al analizar el repositorio se vio que el modelo no existía: `Medianube-Predicciones` estaba vacía y `/demanda` usaba mocks, así que hubo que crear el modelo además de programarlo.

**Prompt / Herramienta utilizada:** Claude Code (Claude Opus 5.5).
*Prompt:* "Necesito configurar Amazon EventBridge para que el modelo predictivo corra automáticamente todas las madrugadas." Primero se pidió y aprobó un plan; después se implementó en la rama `feat/Cronjob` en commits chicos.

**Código / Arquitectura generada:**

- **Modelo `demanda-v1`** (`backend/src/domain/demanda/`): promedio ponderado de las ventas del mismo día de la semana en las últimas 8 semanas, factor por lluvia, confianza según evidencia y dispersión, y precisión estimada con backtest (1 − wMAPE).
- **Caso de uso** `servicioDemanda`: `predecirUsuario` y `predecirTodos`, la corrida nocturna en serie donde un usuario que falla no corta el resto.
- **Adaptadores:** repositorio de Ventas, Productos y Predicciones (SK `<fecha>#<productoID>`, TTL de 30 días) y handler que distingue el evento de EventBridge de una invocación manual con `{ usuarioID }`. Reutiliza el repositorio de clima para leer el pronóstico y listar usuarios.
- **Infraestructura:** Lambda `predecirDemanda` (timeout de 300 s), rol de mínimo privilegio, regla `medianube-prediccion-demanda-<env>` con `cron(30 8 * * ? *)` (05:30 ART), `EventInvokeConfig` con 1 reintento, parámetro `CronPrediccion`, seed de ventas y ADR en `docs/PREDICCION-DEMANDA.md`.

**Validación y Corrección Humana:**

- **Decisiones del equipo:** construir la Lambda dentro del backend hexagonal, en lugar de solo programar la Lambda `sugerencia-produccion` creada desde la consola (que calcula por receta y stock), y correrla a las 05:30 ART, media hora después del refresco de clima. El equipo pidió la rama `feat/Cronjob` en lugar de la que proponía el plan.
- **Restricciones de AWS Academy:** se mantuvo la regla clásica de EventBridge en lugar de EventBridge Scheduler, porque Scheduler necesita un rol IAM propio. También se descartaron SageMaker y Forecast.
- **Sin LLM en la corrida nocturna:** se eligió un modelo estadístico determinístico por costo y reproducibilidad. El LLM queda como opción para explicar las predicciones en una v2.
- **Refactor acotado:** el BatchWrite con reintentos y la detección de eventos programados se extrajeron a módulos compartidos, y la Lambda de clima pasó a usarlos sin cambiar su comportamiento.
- **Pruebas:** 114 tests (dominio, caso de uso, handler y repositorio con un cliente falso), `tsc` sin errores, bundle verificado en Node 22 y template validado (sin referencias rotas). En una corrida completa sin AWS con el patrón del seed, el sábado predice más que el domingo, la lluvia aplica el factor 0,85 y la precisión estimada es de 95 %.
- **Pendiente de validar por el equipo:** desplegar y confirmar en CloudWatch la primera corrida de las 05:30, definir quién carga `Medianube-Ventas` y con qué formato (hoy se asume `cantidad` por día y producto), y conectar `/demanda` a `Medianube-Predicciones`.

## 08/11/2026 - Despliegue seguro y guía de integración del clima para la sugerencia de producción

**Problema abordado:** Persona 1 necesitaba el clima disponible en AWS para el motor predictivo de producción (semana 3), que depende de la tarea "Setup BD & API Clima" (semana 1). El código de las tablas y de `obtenerClima` estaba completo, pero no había confirmación de despliegue ni un camino corto para tener datos de prueba. Tampoco había un contrato de cómo leer el clima desde una Lambda creada fuera del repositorio.

**Prompt / Herramienta utilizada:** Claude Code (Claude Opus 5.5).
*Prompt:* "Haz el plan de ejecución con lo que falta para destrabarlo." Primero se revisó qué estaba hecho y qué faltaba de la tarea; después se pidió y aprobó un plan sobre la rama `feat/API-clima`.

**Código / Arquitectura generada:**

- **Chequeo previo en `deploy.sh`:** antes de compilar, compara las 5 tablas del template con las que ya existen en la cuenta y con las que administra el stack. Si alguna se creó a mano, corta sin borrar nada y muestra la tabla, sus ítems y las dos salidas posibles (borrar o importar). También detecta un stack en `ROLLBACK_COMPLETE`.
- **`scripts/preparar-demo.sh`:** carga en un paso la ubicación, los productos, las facturas y las ventas de un usuario. Después invoca `obtenerClima` y `predecirDemanda` y verifica las filas resultantes, con un resumen por paso.
- **`docs/INTEGRACION-CLIMA.md`:** guía para Persona 1 con el esquema de `Medianube-Clima` y `Medianube-Predicciones`, un ejemplo de `QueryCommand`, la alternativa `GET /clima`, qué tolerar y los permisos.

**Validación y Corrección Humana:**

- **Decisiones del equipo:** trabajar en la rama `feat/API-clima` y que los commits los haga el integrante a mano desde su cuenta.
- **Seguridad de datos:** el chequeo nunca borra tablas, porque podrían tener datos de un compañero; la decisión queda en el equipo. La comparación contra los recursos del stack también cubre las tablas que se agreguen al template más adelante.
- **Pruebas:** `bash -n` sobre los dos scripts. El chequeo previo se probó con un `aws` simulado en cinco escenarios (tabla creada a mano con el stack nuevo o existente, `ROLLBACK_COMPLETE`, sin conflictos y cuenta limpia). `preparar-demo.sh` se probó con un camino exitoso, una Lambda que falla y argumentos inválidos. El ejemplo de la guía se validó con `node --check`. Los tests del backend no cambian.
- **Pendiente de validar por el equipo:** correr `deploy.sh` y `preparar-demo.sh` en CloudShell con la cuenta real. Que Persona 2 guarde la ubicación del negocio con `UpdateItem`.

## 10/11/2026 - Implementación de Load Leveling con Amazon SQS (Procesamiento de Facturas)

- **Problema abordado:** El procesamiento directo de imágenes desde S3 a la Lambda `procesarFactura` con IA (Gemini) corría el riesgo de agotar la concurrencia, saturar la API externa o duplicar invocaciones ante ráfagas de subidas simultáneas.
- **Prompt / Herramienta utilizada:** Asistencia de Gemini (Chat) para reescribir la firma del handler de S3 a SQS y desempaquetar el payload anidado.
- **Código / Arquitectura generada:** Se interpuso una cola SQS estándar (`medianube-facturas-queue`) como destino de eventos de S3. El código de la Lambda se modificó para iterar sobre `event.Records` de SQS, haciendo un `JSON.parse(sqsRecord.body)` para recuperar el evento S3 subyacente.
- **Validación y Corrección Humana:** Se configuraron manualmente las políticas de IAM para que S3 pueda hacer `sqs:SendMessage` y la Lambda pueda hacer `sqs:ReceiveMessage`. Se ajustó críticamente el *Visibility Timeout* de la cola a 90 segundos para que sea igual al *Timeout* de la Lambda, evitando bucles de reintentos infinitos por cortes prematuros.