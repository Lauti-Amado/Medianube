# Backend Medianube (Serverless)

Infraestructura como código (CloudFormation) para la capa de datos y la Lambda de clima.

```
backend/
├── functions/obtenerClima/   # Lambda Node.js 22 (sin dependencias, el AWS SDK v3 viene en el runtime)
│   ├── index.mjs             # entrypoint: config por env y armado de dependencias
│   ├── http.mjs              # adaptador de eventos API Gateway v2 / EventBridge
│   ├── clima.mjs             # lógica cache-first (testeable sin AWS)
│   ├── repositorio.mjs       # acceso a DynamoDB
│   ├── openMeteo.mjs         # cliente de Open-Meteo (sin API key)
│   └── weatherCodes.mjs      # códigos WMO → español
├── infra/template.yaml       # 5 tablas + Lambda + GET /clima + regla diaria
├── events/                   # eventos de prueba para la consola o el CLI
├── scripts/deploy.sh         # package + deploy (CloudShell)
├── scripts/seed-ubicacion.sh # carga la ubicación de un usuario
└── tests/                    # node:test
```

## Tests

```bash
cd backend
npm test        # node --test, sin instalar nada
```

## Despliegue (AWS CloudShell, región us-east-2)

1. Abrir CloudShell, clonar el repo y pasar a la rama: `git clone … && cd Medianube/backend && git checkout feat/setupBD`
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
