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
| `Gastos` | `gastoID` (S) | — | — | Facturas procesadas por `procesarFactura` y leídas por `listarGastos`. |

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