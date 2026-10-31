# Backend Medianube (Serverless)

Infraestructura como código (CloudFormation) para la capa de datos y la Lambda de clima.
El código sigue una **arquitectura hexagonal** (puertos y adaptadores) en **TypeScript**.

```
backend/
├── src/
│   ├── domain/                       # reglas puras, sin I/O ni imports de AWS
│   │   └── clima/                    #   tipos, errores, reglas de fecha/ubicación, códigos WMO
│   ├── application/                  # casos de uso: orquestan dominio + puertos
│   │   └── clima/servicioClima.ts    #   cache-first, fallback a cache vencida, refresco masivo
│   ├── ports/                        # contratos (interfaces) que necesita la aplicación
│   │   ├── clima.ts                  #   ClimaRepositorioPort, PronosticoPort
│   │   └── logger.ts
│   ├── adapters/
│   │   ├── in/lambdaClima.ts         #   evento API Gateway v2 / EventBridge → caso de uso
│   │   └── out/                      #   implementaciones de los puertos
│   │       ├── climaRepositorioDynamo.ts
│   │       └── openMeteo.ts
│   └── composition/obtenerClima.ts   # composition root: lee env y conecta todo (entrypoint de la Lambda)
├── infra/template.yaml               # 5 tablas + Lambda + GET /clima + regla diaria
├── events/                           # eventos de prueba para la consola o el CLI
├── scripts/
│   ├── build.mjs                     # esbuild: un bundle por Lambda en dist/<nombre>/index.mjs
│   ├── deploy.sh                     # check + build + package + deploy (CloudShell)
│   └── seed-ubicacion.sh             # carga la ubicación de un usuario
├── tests/                            # node:test + tsx, un directorio por capa
└── dist/                             # generado (ignorado por git)
```

**Regla de dependencias:** `adapters → application → domain`. El dominio no importa nada;
la aplicación solo conoce `ports`. Cambiar de base de datos o de proveedor de clima es escribir
un adaptador nuevo, sin tocar casos de uso. Para sumar una Lambda: caso de uso en `application/`,
adaptador de entrada en `adapters/in/`, composition root en `composition/` y registrarla en `scripts/build.mjs`.

## Desarrollo

```bash
cd backend
npm install
npm run check     # typecheck (tsc --noEmit) + tests
npm test          # solo tests (node --test con tsx)
npm run build     # genera dist/obtenerClima/index.mjs con esbuild
```

## Despliegue (AWS CloudShell, región us-east-2)

1. Abrir CloudShell, clonar el repo y pasar a la rama: `git clone … && cd Medianube/backend && git checkout <rama>`
   (requiere Node.js 22: `node --version`; si CloudShell trae otra versión, `nvm install 22`).
2. Desplegar:
   ```bash
   chmod +x scripts/*.sh
   ./scripts/deploy.sh                       # cuenta normal: el stack crea un rol de mínimo privilegio
   ROL_LAMBDA=LabRole ./scripts/deploy.sh    # AWS Academy: no se pueden crear roles IAM
   ```
3. Cargar la ubicación del usuario de prueba:
   ```bash
   ./scripts/seed-ubicacion.sh user_test_123 "La Plata" -34.9214 -57.9545
   ```

> Si `Medianube-Clima` u otra tabla ya existe (creada a mano), CloudFormation falla con
> *"already exists"*. Hay que borrarla o importarla al stack antes de desplegar.

## Verificación

```bash
# Primera llamada: "origen": "open-meteo". Segunda llamada: "origen": "cache"
curl "https://1i2vqeifsi.execute-api.us-east-2.amazonaws.com/clima?usuarioID=user_test_123"

# Refresco programado (simula EventBridge)
aws lambda invoke --function-name obtenerClima-dev \
  --payload fileb://events/refresco-programado.json /dev/stdout

# Ver la cache
aws dynamodb query --table-name Medianube-Clima \
  --key-condition-expression "usuarioID = :u" \
  --expression-attribute-values '{":u":{"S":"user_test_123"}}'
```

## Autenticación de `/clima`

| `MODO_AUTH` | Comportamiento |
|---|---|
| `dev` (por defecto) | Sin authorizer. La Lambda acepta `?usuarioID=`. **Solo para desarrollo.** |
| `jwt` | API Gateway valida el `idToken` de Cognito (header `Authorization`) y la Lambda usa el claim `sub`. Responde 401 sin token. |

Para pasar a producción: `MODO_AUTH=jwt ./scripts/deploy.sh`.

> **Ojo:** el `sub` de Cognito no es `user_test_123`. Cuando se active `jwt`, el frontend tiene que
> guardar la configuración usando el `sub` del usuario logueado como `usuarioID`.

## Contrato de `GET /clima`

```json
{
  "usuarioID": "user_test_123",
  "ubicacion": { "lat": -34.9214, "lon": -57.9545, "ciudad": "La Plata" },
  "ubicacionPorDefecto": false,
  "origen": "cache | open-meteo",
  "desactualizado": false,
  "dias": [
    { "fecha": "2026-10-18", "tempMax": 14.8, "tempMin": 7.2, "precipitacionMm": 0,
      "probLluvia": 4, "codigoClima": 3, "descripcion": "Nublado", "actualizadoEn": "2026-10-18T23:57:00.000Z" }
  ]
}
```

| Código | Causa |
|---|---|
| 200 | OK (`desactualizado: true` si Open-Meteo falló y se devolvió la última cache) |
| 400 | El usuario no tiene ubicación y no hay ubicación por defecto |
| 401 | Sin identidad (sin JWT, o falta `usuarioID` en modo dev) |
| 502 | Open-Meteo no responde y no hay cache |
