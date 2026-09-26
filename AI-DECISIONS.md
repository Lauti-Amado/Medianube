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