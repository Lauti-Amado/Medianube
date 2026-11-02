# Backend Medianube (Serverless)

Infraestructura como código (CloudFormation) para la capa de datos, la Lambda de clima y el
motor de precios con LLM. El código sigue una **arquitectura hexagonal** (puertos y adaptadores) en **TypeScript**.

```
backend/
├── src/
│   ├── domain/                       # reglas puras, sin I/O ni imports de AWS
│   │   ├── errores.ts                #   ErrorValidacion (400) y ErrorServicioExterno (con motivo de la falla)
│   │   ├── clima/                    #   tipos, reglas de fecha/ubicación, códigos WMO
│   │   └── precios/                  #   unidades, emparejamiento de insumos, costos por receta, guardas
│   ├── application/                  # casos de uso: orquestan dominio + puertos
│   │   ├── dependencias.ts           #   registro uniforme de caídas ("dependencia_caida")
│   │   ├── clima/servicioClima.ts    #   cache-first, fallback a cache vencida, refresco masivo
│   │   └── precios/servicioPrecios.ts #  ticket + historial + recetas → LLM → guardas → sugerencias
│   ├── ports/                        # contratos (interfaces) que necesita la aplicación
│   │   ├── clima.ts                  #   ClimaRepositorioPort, PronosticoPort
│   │   ├── precios.ts                #   PreciosRepositorioPort, SugeridorPreciosPort
│   │   └── logger.ts
│   ├── adapters/
│   │   ├── in/                       #   evento API Gateway v2 / EventBridge → caso de uso
│   │   │   ├── http.ts               #     identidad (JWT / ?usuarioID=) y respuestas, compartido
│   │   │   ├── lambdaClima.ts
│   │   │   └── lambdaPrecios.ts
│   │   └── out/                      #   implementaciones de los puertos
│   │       ├── climaRepositorioDynamo.ts
│   │       ├── openMeteo.ts
│   │       ├── preciosRepositorioDynamo.ts
│   │       └── claude/               #     prompt versionado + cliente de la API de Claude
│   └── composition/                  # composition roots: leen env y conectan todo (entrypoints)
│       ├── obtenerClima.ts
│       └── sugerirPrecios.ts
├── infra/template.yaml               # 5 tablas + 2 Lambdas + GET /clima + POST /precios/sugerir + regla diaria
├── events/                           # eventos de prueba para la consola o el CLI
├── scripts/
│   ├── build.mjs                     # esbuild: un bundle por Lambda en dist/<nombre>/index.mjs
│   ├── deploy.sh                     # check + build + package + deploy (CloudShell)
│   ├── seed-ubicacion.sh             # carga la ubicación de un usuario
│   └── seed-precios.mjs              # carga productos con receta y facturas históricas de demo
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
npm run build     # genera dist/obtenerClima/ y dist/sugerirPrecios/ con esbuild
node --import tsx --test tests/domain/precios.test.ts   # un solo archivo de tests
```

## Despliegue (AWS CloudShell, región us-east-2)

1. Abrir CloudShell, clonar el repo y pasar a la rama: `git clone … && cd Medianube/backend && git checkout <rama>`
   (requiere Node.js 22: `node --version`; si CloudShell trae otra versión, `nvm install 22`).
2. Desplegar:
   ```bash
   chmod +x scripts/*.sh
   ./scripts/deploy.sh                       # cuenta normal: el stack crea un rol de mínimo privilegio
   ROL_LAMBDA=LabRole ./scripts/deploy.sh    # AWS Academy: no se pueden crear roles IAM

   # Motor de precios: la API key de Anthropic se pasa una vez; los redeploys sin la variable la conservan.
   CLAUDE_API_KEY=sk-ant-... ROL_LAMBDA=LabRole ./scripts/deploy.sh
   MODELO_LLM=claude-haiku-5-5 ./scripts/deploy.sh   # opcional: modelo más barato (default claude-opus-5-5)
   ```
   Sin API key la Lambda de precios igual responde, pero solo con reglas (`"origen": "reglas"`).
3. Cargar datos del usuario de prueba:
   ```bash
   ./scripts/seed-ubicacion.sh user_test_123 "La Plata" -34.9214 -57.9545
   node scripts/seed-precios.mjs user_test_123   # productos con receta + 4 facturas históricas
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

# Motor de precios: sugerencias para un ticket (después de seed-precios.mjs)
aws lambda invoke --function-name sugerirPrecios-dev \
  --payload fileb://events/post-precios-dev.json /dev/stdout
```

## Autenticación de `/clima` y `/precios/sugerir`

| `MODO_AUTH` | Comportamiento |
|---|---|
| `dev` (por defecto) | Sin authorizer. La Lambda acepta `?usuarioID=`. **Solo para desarrollo.** |
| `jwt` | API Gateway valida el `idToken` de Cognito (header `Authorization`) y la Lambda usa el claim `sub`. Responde 401 sin token. |

Para pasar a producción: `MODO_AUTH=jwt ./scripts/deploy.sh`.

> **Ojo:** el `sub` de Cognito no es `user_test_123`. Cuando se active `jwt`, el frontend tiene que
> guardar la configuración usando el `sub` del usuario logueado como `usuarioID`.

## Manejo de errores

Una dependencia externa caída (Open-Meteo, Claude) **nunca es un error HTTP**: se responde 200 con el
mejor dato disponible y el motivo explícito. Solo un problema propio da 5xx, y siempre como JSON con
`requestId` para buscarlo en CloudWatch. Diseño completo: [docs/MANEJO-ERRORES.md](../docs/MANEJO-ERRORES.md).

| Falla | `GET /clima` | `POST /precios/sugerir` |
|---|---|---|
| Open-Meteo caído, con cache | 200, cache con `desactualizado: true` y `aviso` | — |
| Open-Meteo caído, sin cache | 200, `disponible: false`, `origen: "sin-datos"`, `dias: []` | — |
| Claude caído, lento, sin key o rechazo | — | 200 por reglas, `degradado: true` y `motivoDegradacion` |
| No se pudieron guardar las sugerencias | — | 200 con `guardado: false` |
| Throttling de DynamoDB | 503 + `Retry-After: 2` | 503 + `Retry-After: 2` |
| Error inesperado | 500 `{ error, requestId }` | 500 `{ error, requestId }` |

Cada caída se loguea como una línea `{"evento":"dependencia_caida","servicio","motivo",...}` y se cuenta
en las métricas `Medianube/CaidasOpenMeteo-<env>` y `Medianube/CaidasClaude-<env>` de CloudWatch.

## Contrato de `GET /clima`

```json
{
  "usuarioID": "user_test_123",
  "ubicacion": { "lat": -34.9214, "lon": -57.9545, "ciudad": "La Plata" },
  "ubicacionPorDefecto": false,
  "origen": "cache | open-meteo | sin-datos",
  "disponible": true,
  "desactualizado": false,
  "aviso": null,
  "dias": [
    { "fecha": "2026-10-18", "tempMax": 14.8, "tempMin": 7.2, "precipitacionMm": 0,
      "probLluvia": 4, "codigoClima": 3, "descripcion": "Nublado", "actualizadoEn": "2026-10-18T23:57:00.000Z" }
  ]
}
```

| Código | Causa |
|---|---|
| 200 | OK. Si Open-Meteo no responde: la última cache con `desactualizado: true`, o sin cache `disponible: false` y `dias: []`. En ambos casos con `aviso` para mostrar |
| 400 | El usuario no tiene ubicación y no hay ubicación por defecto |
| 401 | Sin identidad (sin JWT, o falta `usuarioID` en modo dev) |
| 500 / 503 | Error propio (503 con `Retry-After` si DynamoDB está saturado), con `requestId` |

Open-Meteo se consulta con 4 s de timeout y un reintento ante errores transitorios (red, timeout, 429, 5xx).
El refresco programado deja de llamarlo tras 2 caídas seguidas (circuit breaker) y no empieza otro usuario
si a la invocación le quedan menos de 10 s; el resumen informa `omitidosPorProveedor` y `pendientes`.

## Contrato de `POST /precios/sugerir`

Recibe el ticket ya revisado por la persona (pantalla "subir factura"), lo compara con el historial de
compras de los últimos 90 días y sugiere precios para los productos cuya receta usa algún insumo del ticket.
Diseño y criterios: [docs/MOTOR-PRECIOS.md](../docs/MOTOR-PRECIOS.md).

```json
{ "ticket": { "proveedor": "Molino Cañuelas", "fecha": "2026-10-31",
    "items": [ { "descripcion": "Harina 000 x 25 kg", "cantidad": 4, "precioUnitario": 8200 } ] } }
```

`precioUnitario` es el precio de la presentación (la bolsa de 25 kg); el tamaño se toma de la descripción
o de un campo `unidad` opcional.

```json
{
  "usuarioID": "user_test_123",
  "origen": "llm | reglas",
  "versionPrompt": "precios-v1",
  "generadaEn": "2026-10-31T15:00:00.000Z",
  "insumos": [
    { "insumo": "harina 000", "descripcionTicket": "Harina 000 x 25 kg", "unidad": "kg",
      "precioAnterior": 284, "precioNuevo": 328, "variacionPct": 15.5, "variacionVsPromedioPct": 23.3, "certeza": "alta" }
  ],
  "sugerencias": [
    { "productoID": "medialuna-manteca", "nombre": "Medialunas de manteca (u.)", "categoria": "panadería",
      "costoAnterior": 32.88, "costoNuevo": 36.06, "precioActual": 420, "precioSugerido": 470,
      "variacionPct": 11.9, "margenResultante": 0.923, "estado": "ajustar | estable", "confianza": "alta | media | baja",
      "justificacion": "La harina 000 subió 15,5 % respecto de la última compra; …",
      "insumosAfectados": ["harina 000", "manteca"], "ajustadoPorReglas": false, "origen": "llm | reglas" }
  ],
  "productosSinReceta": ["Alfajor de maicena (u.)"],
  "degradado": false,
  "motivoDegradacion": "null | sin_api_key | timeout | limite | no_disponible | rechazo | respuesta_invalida | sin_tiempo",
  "guardado": true
}
```

Cada sugerencia también se guarda en el atributo `sugerencia` del producto en `Medianube-Productos`.
Para que un producto entre al cálculo necesita `precioActual` y `receta: [{ insumo, cantidad, unidad }]`
(cantidad por unidad de venta; unidades `g`, `kg`, `ml`, `l`, `u`).

| Código | Causa |
|---|---|
| 200 | OK. Si Claude no responde a tiempo, rechaza la solicitud o no hay API key: `origen: "reglas"`, `degradado: true` y `motivoDegradacion`. Si no se pudo guardar: `guardado: false` |
| 400 | Cuerpo que no es JSON, ticket sin ítems o ítems sin descripción/cantidad/precio positivos |
| 401 | Sin identidad (sin JWT, o falta `usuarioID` en modo dev) |
| 500 / 503 | Error propio (503 con `Retry-After` si DynamoDB está saturado), con `requestId` |

El tiempo del LLM se acota a lo que le queda a la Lambda menos 4 s (para guardar y responder antes del
corte de 30 s de API Gateway). Con menos de 3 s disponibles no se lo llama (`motivoDegradacion: "sin_tiempo"`).

| Variable de entorno | Default | Uso |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Parámetro `ClaudeApiKey` del stack (`CLAUDE_API_KEY` en `deploy.sh`) |
| `MODELO_LLM` | `claude-opus-5-5` | Modelo de Claude |
| `ESFUERZO_LLM` | `low` | `output_config.effort` (`low`, `medium`, `high`) |
| `TIMEOUT_LLM_MS` | `22000` | Corte máximo de la llamada al LLM; se acota además al tiempo restante de la invocación |
| `MARGEN_OBJETIVO_DEFECTO` | `0.6` | Si el negocio no tiene `margenObjetivo` en Configuración ni en el producto |
| `MARGEN_MINIMO` | `0.3` | Piso de margen que ninguna sugerencia puede perforar |
| `TOPE_SUBA_PCT` | `0.25` | Suba máxima por ajuste |
| `VENTANA_HISTORIAL_DIAS` | `90` | Historial de compras considerado |
