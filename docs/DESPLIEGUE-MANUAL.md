# Despliegue manual de recursos en AWS (`us-east-2`)

Aunque la capa de datos y las funciones del backend están definidas como código en `backend/infra/template.yaml`, el entorno de **AWS CloudShell** se encuentra bloqueado en la cuenta del proyecto con el mensaje *"La verificación de su cuenta está en curso"*, lo que impide ejecutar `backend/scripts/deploy.sh` (`aws cloudformation package/deploy`).

Para destrabar la integración de punta a punta de `/demanda` y `/clima`, los siguientes recursos se aprovisionaron manualmente desde la consola de AWS en la región `us-east-2` respetando el diseño de `template.yaml`.

## Inventario de recursos creados a mano

### 1. Tablas DynamoDB (Modo On-Demand)
| Nombre de tabla | Partition Key (HASH) | Sort Key (RANGE) | TTL | Notas |
|---|---|---|---|---|
| `Medianube-Clima` | `usuarioID` (S) | `fecha` (S) | `expiraEn` | Cache de pronóstico de 7 días (Open-Meteo). |
| `Medianube-Predicciones` | `usuarioID` (S) | `fechaProducto` (S) | `expiraEn` | Demanda estimada por día y producto (`<YYYY-MM-DD>#<productoID>`). Reemplaza a la tabla `Prediccion-demanda` que tenía clave simple mal tipada. |
| `Medianube-Configuracion` | `usuarioID` (S) | — | — | Configuración general y ubicación del negocio. |
| `Gastos` | `gastoID` (S) | — | — | Facturas procesadas por `procesarFactura` y leídas por `listarGastos`. Índice global `usuarioID-fecha-index` (`usuarioID` S, `fecha` S) para paginar el historial (ver `backend/lambdas-consola/README.md`). |

### 2. Funciones AWS Lambda
| Nombre en consola | Runtime / Arq. | Código fuente en el repo | Variables de entorno configuradas |
|---|---|---|---|
| `obtenerClima` | `nodejs22.x` | Bundle de `dist/obtenerClima/index.mjs` | `TABLA_CLIMA=Medianube-Clima`, `TABLA_CONFIGURACION=Medianube-Configuracion`, `PERMITIR_USUARIO_QUERY=true`, `ZONA_HORARIA=America/Argentina/Buenos_Aires` |
| `leerDemanda` | `nodejs22.x` | Bundle de `dist/leerDemanda/index.mjs` | `TABLA_PREDICCIONES=Medianube-Predicciones`, `PERMITIR_USUARIO_QUERY=true`, `ZONA_HORARIA=America/Argentina/Buenos_Aires` |

### 3. Rutas en Amazon API Gateway (HTTP API `1i2vqeifsi`)
- **`GET /clima`** → Integración proxy con la Lambda `obtenerClima` (sin authorizer mientras `ModoAutenticacion=dev`).
- **`GET /demanda`** → Integración proxy con la Lambda `leerDemanda` (sin authorizer mientras `ModoAutenticacion=dev`).

### 4. Permisos IAM
La cuenta del proyecto es una cuenta AWS estándar con plan gratuito (no AWS Academy, por lo que no existe `LabRole`). Al rol de ejecución de las Lambdas se le otorgaron permisos sobre DynamoDB (`dynamodb:Query`, `dynamodb:GetItem`, `dynamodb:Scan`, `dynamodb:BatchWriteItem`) para `Medianube-Clima`, `Medianube-Predicciones` y `Medianube-Configuracion`.

## Advertencia antes de correr `deploy.sh`

1. **Chequeo de tablas existentes:** Si en el futuro se habilita CloudShell o se corre `backend/scripts/deploy.sh` con AWS CLI local, el chequeo previo del script detendrá la ejecución al detectar que `Medianube-Clima` y `Medianube-Predicciones` fueron creadas fuera del stack de CloudFormation.
2. **Colisión de rutas en API Gateway:** El template intenta crear las rutas `GET /clima` y `GET /demanda` en la API `1i2vqeifsi`. Como ya existen manualmente, CloudFormation fallará con error de conflicto (`ConflictException`) a menos que antes se eliminen las rutas manuales o se importen al stack.

## Predicción de demanda nocturna (`predecirDemanda`, 15/11/2026)

Con el mismo criterio, la Lambda que genera las predicciones y su disparador diario se crearon a mano copiando los
valores de `template.yaml`. Con esto `Medianube-Predicciones` deja de cargarse a mano: la escribe el modelo cada
madrugada. El diseño está en `docs/PREDICCION-DEMANDA.md`.

### Recursos

| Recurso | Configuración |
|---|---|
| Tabla `Medianube-Ventas` | On-Demand. PK `usuarioID` (S), SK `fechaProducto` (S, `<YYYY-MM-DD>#<productoID>`). Sin TTL. |
| Lambda `predecirDemanda-dev` | `nodejs22.x` arm64, handler `index.handler`, 256 MB, timeout 5 min. Código: `.zip` con `dist/predecirDemanda/index.mjs` (`npm run build`). |
| Variables de entorno | `TABLA_VENTAS=Medianube-Ventas`, `TABLA_PRODUCTOS=Producto`, `TABLA_PREDICCIONES=Medianube-Predicciones`, `TABLA_CLIMA=Medianube-Clima`, `TABLA_CONFIGURACION=Medianube-Configuracion`, `ZONA_HORARIA=America/Argentina/Buenos_Aires`, `DIAS_PREDICCION=7`, `SEMANAS_HISTORIAL=8`, `FACTOR_LLUVIA=0.85`, `TTL_PREDICCION_DIAS=30` |
| Rol de ejecución | Rol exclusivo de la función con `AWSLambdaBasicExecutionRole` (logs) y la política en línea `AccesoTablasDemanda`, con lo que usa `predecirDemanda`: `Query` en Ventas y Clima, `BatchWriteItem` en Predicciones y `Scan` en Configuración y Producto. Se le quitó `PowerUserAccess`, que la consola había asignado al crearla. |
| Regla `medianube-prediccion-demanda-dev` | Regla programada clásica en el bus `default`, `cron(30 8 * * ? *)` (05:30 ART), destino `predecirDemanda-dev` con el evento coincidente como entrada. La Lambda la muestra como desencadenador. |

### Catálogo y datos de prueba

- Los nombres de los productos salen de la tabla `Producto` (la misma del motor de precios), que no tiene
  `usuarioID`; por eso `TABLA_PRODUCTOS=Producto` y el repositorio la recorre con un Scan.
- Mientras no exista un productor real de ventas, `Medianube-Ventas` se cargó con
  `node scripts/seed-ventas.mjs user_test_123` (392 ítems: 8 semanas, 7 productos con los mismos `productoID` que `Producto`).
  Como CloudShell está bloqueado, se corrió desde una PC con un usuario IAM temporal con permiso de escritura sobre
  esa tabla, que se borró al terminar.

### Verificación

1. Prueba en la consola de Lambda con `{ "usuarioID": "user_test_123" }` (un solo usuario).
2. `GET /demanda?usuarioID=user_test_123` devuelve 49 filas (7 productos × 7 días) y una precisión de backtest de 0,946.
3. Corrida completa, como la de la regla: prueba con `{ "source": "aws.events", "detail-type": "Scheduled Event", "detail": {} }`,
   que recorre todos los usuarios de `Medianube-Configuracion` y responde `procesados`, `predicciones` y `fallidos`.

### Diferencias con `template.yaml`

- Si no se configuró la invocación asincrónica, la Lambda usa el valor por defecto de AWS (2 reintentos, 6 h) en
  lugar de 1 reintento y 1 h (`EventInvokeConfig`).
- El grupo de logs lo crea Lambda sin vencimiento; el template lo deja en 14 días.
- `deploy.sh` intentaría crear de nuevo `Medianube-Ventas`, la función y la regla, así que también chocaría con estos
  recursos (ver la advertencia anterior).

## Refresco programado del clima (`obtenerClima`, 15/11/2026)

La predicción de las 05:30 lee el pronóstico de `Medianube-Clima`. Sin un refresco programado, esa tabla solo se
actualizaba cuando alguien abría `/clima`, y la predicción podía quedar sin pronóstico (sin factor de lluvia y con
menos confianza). Se agregó la regla de las 05:00 que define `template.yaml` (`ReglaRefrescoClima`).

| Recurso | Configuración |
|---|---|
| Lambda `obtenerClima` | Sin cambios de código: el bundle desplegado ya reconoce el evento programado (`source: aws.events`) y recorre los usuarios de `Medianube-Configuracion`. Timeout de 20 s, necesario porque el refresco corta con 10 s de margen antes del timeout. |
| Rol de `obtenerClima` | `AWSLambdaBasicExecutionRole` y la política administrada por el cliente `obtenerClima-role-…Policy`: `Query` + `BatchWriteItem` en Clima, `GetItem` + `Scan` en Configuración. Coincide con `RolObtenerClima`, no hubo que cambiarla. |
| Regla `medianube-refresco-clima-dev` | Regla programada clásica en el bus `default`, `cron(0 8 * * ? *)` (05:00 ART), destino `obtenerClima` con el evento coincidente como entrada. La Lambda la muestra como desencadenador junto a la ruta `GET /clima`. |

**Verificación:** prueba en la consola con `backend/events/refresco-programado.json` → `total 1, actualizados 1,
omitidos 0, pendientes 0, fallidos []`. Al día siguiente, `GET /clima` tiene que mostrar un `actualizadoEn` cercano a
las 08:00 UTC.
