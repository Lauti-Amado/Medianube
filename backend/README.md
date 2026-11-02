# Backend Medianube (Serverless)

Infraestructura como código (CloudFormation) para la capa de datos, la Lambda de clima, el
motor de precios con LLM y la predicción de demanda programada con EventBridge. El código sigue una **arquitectura hexagonal** (puertos y adaptadores) en **TypeScript**.

```
backend/
├── src/
│   ├── domain/                       # reglas puras, sin I/O ni imports de AWS
│   │   ├── errores.ts                #   ErrorValidacion (400) y ErrorServicioExterno (502)
│   │   ├── clima/                    #   tipos, reglas de fecha/ubicación, códigos WMO
│   │   ├── demanda/                  #   modelo estadístico: mismo día de la semana, lluvia, confianza, backtest
│   │   └── precios/                  #   unidades, emparejamiento de insumos, costos por receta, guardas
│   ├── application/                  # casos de uso: orquestan dominio + puertos
│   │   ├── clima/servicioClima.ts    #   cache-first, fallback a cache vencida, refresco masivo
│   │   ├── demanda/servicioDemanda.ts #  predicción de 7 días por producto, corrida nocturna para todos
│   │   └── precios/servicioPrecios.ts #  ticket + historial + recetas → LLM → guardas → sugerencias
│   ├── ports/                        # contratos (interfaces) que necesita la aplicación
│   │   ├── clima.ts                  #   ClimaRepositorioPort, PronosticoPort
│   │   ├── demanda.ts                #   DemandaRepositorioPort, ClimaLecturaPort
│   │   ├── precios.ts                #   PreciosRepositorioPort, SugeridorPreciosPort
│   │   └── logger.ts
│   ├── adapters/
│   │   ├── in/                       #   evento API Gateway v2 / EventBridge → caso de uso
│   │   │   ├── http.ts               #     identidad (JWT / ?usuarioID=) y respuestas, compartido
│   │   │   ├── eventos.ts            #     detección de eventos programados de EventBridge
│   │   │   ├── lambdaClima.ts
│   │   │   ├── lambdaDemanda.ts
│   │   │   └── lambdaPrecios.ts
│   │   └── out/                      #   implementaciones de los puertos
│   │       ├── dynamo.ts             #     cliente y BatchWrite con reintentos, compartido
│   │       ├── climaRepositorioDynamo.ts
│   │       ├── demandaRepositorioDynamo.ts
│   │       ├── openMeteo.ts
│   │       ├── preciosRepositorioDynamo.ts
│   │       └── claude/               #     prompt versionado + cliente de la API de Claude
│   └── composition/                  # composition roots: leen env y conectan todo (entrypoints)
│       ├── obtenerClima.ts
│       ├── predecirDemanda.ts
│       └── sugerirPrecios.ts
├── infra/template.yaml               # 5 tablas + 3 Lambdas + GET /clima + POST /precios/sugerir + 2 reglas diarias
├── events/                           # eventos de prueba para la consola o el CLI
├── scripts/
│   ├── build.mjs                     # esbuild: un bundle por Lambda en dist/<nombre>/index.mjs
│   ├── deploy.sh                     # check + build + package + deploy (CloudShell)
│   ├── seed-ubicacion.sh             # carga la ubicación de un usuario
│   ├── seed-precios.mjs              # carga productos con receta y facturas históricas de demo
│   └── seed-ventas.mjs               # carga 8 semanas de ventas diarias de demo (predicción de demanda)
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
npm run build     # genera dist/obtenerClima/, dist/sugerirPrecios/ y dist/predecirDemanda/ con esbuild
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
   CRON_PREDICCION="cron(0 9 * * ? *)" ./scripts/deploy.sh   # opcional: otro horario (UTC) para la predicción
   ```
   Sin API key la Lambda de precios igual responde, pero solo con reglas (`"origen": "reglas"`).
3. Cargar datos del usuario de prueba:
   ```bash
   ./scripts/seed-ubicacion.sh user_test_123 "La Plata" -34.9214 -57.9545
   node scripts/seed-precios.mjs user_test_123   # productos con receta + 4 facturas históricas
   node scripts/seed-ventas.mjs user_test_123    # 8 semanas de ventas para la predicción de demanda
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

# Predicción de demanda (después de seed-ventas.mjs): corrida programada o de un solo usuario
aws lambda invoke --function-name predecirDemanda-dev \
  --payload fileb://events/prediccion-programada.json /dev/stdout
aws lambda invoke --function-name predecirDemanda-dev \
  --payload fileb://events/predecir-usuario-dev.json /dev/stdout
aws dynamodb query --table-name Medianube-Predicciones \
  --key-condition-expression "usuarioID = :u" \
  --expression-attribute-values '{":u":{"S":"user_test_123"}}'
aws events describe-rule --name medianube-prediccion-demanda-dev   # cron y estado ENABLED
```

## Tareas programadas (EventBridge)

| Hora (ART) | Regla | Lambda | Qué hace |
|---|---|---|---|
| 05:00 | `medianube-refresco-clima-<env>` | `obtenerClima` | Refresca el pronóstico de 7 días de cada usuario en `Medianube-Clima` |
| 05:30 | `medianube-prediccion-demanda-<env>` | `predecirDemanda` | Predice la demanda de hoy a hoy+6 por producto y la guarda en `Medianube-Predicciones` |

La predicción corre después del clima para usar el pronóstico recién actualizado. Recorre los usuarios
de `Medianube-Configuracion` en serie, y si un usuario falla la corrida sigue con el resto. El resumen
(`total`, `procesados`, `sinVentas`, `predicciones`, `fallidos`) queda en CloudWatch
(`/aws/lambda/predecirDemanda-<env>`). Diseño del modelo: [docs/PREDICCION-DEMANDA.md](../docs/PREDICCION-DEMANDA.md).

Ítem de `Medianube-Predicciones` (una fila por día y producto; volver a correr el mismo día la pisa):

```json
{ "usuarioID": "user_test_123", "fechaProducto": "2026-11-07#medialuna-manteca", "fecha": "2026-11-07",
  "productoID": "medialuna-manteca", "nombre": "Medialunas de manteca (u.)", "cantidad": 274, "base": 322.03,
  "factorClima": 0.85, "confianza": "alta | media | baja", "observaciones": 8, "precisionPct": 0.954,
  "versionModelo": "demanda-v1", "generadaEn": "2026-11-01T08:30:00.000Z", "expiraEn": 1796113800 }
```

`factorClima` es `null` si no había pronóstico para ese día; en ese caso la confianza baja un nivel.
Se espera que `Medianube-Ventas` tenga una fila por día y producto (`fechaProducto` = `<YYYY-MM-DD>#<productoID>`,
`cantidad`). También se aceptan `unidades` y `cantidadVendida`.

| Variable de entorno | Default | Uso |
|---|---|---|
| `DIAS_PREDICCION` | `7` | Días hacia adelante (desde hoy) |
| `SEMANAS_HISTORIAL` | `8` | Semanas del mismo día de la semana que se promedian |
| `FACTOR_LLUVIA` | `0.85` | Multiplicador si se pronostica lluvia (≥ 60 % o ≥ 2 mm) |
| `TTL_PREDICCION_DIAS` | `30` | Vencimiento de cada ítem (atributo `expiraEn`) |
| `ZONA_HORARIA` | `America/Argentina/Buenos_Aires` | Define qué es "hoy" |

## Autenticación de `/clima` y `/precios/sugerir`

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
  "productosSinReceta": ["Alfajor de maicena (u.)"]
}
```

Cada sugerencia también se guarda en el atributo `sugerencia` del producto en `Medianube-Productos`.
Para que un producto entre al cálculo necesita `precioActual` y `receta: [{ insumo, cantidad, unidad }]`
(cantidad por unidad de venta; unidades `g`, `kg`, `ml`, `l`, `u`).

| Código | Causa |
|---|---|
| 200 | OK. Con `origen: "reglas"` si Claude no respondió a tiempo, rechazó la solicitud o no hay API key |
| 400 | Cuerpo que no es JSON, ticket sin ítems o ítems sin descripción/cantidad/precio positivos |
| 401 | Sin identidad (sin JWT, o falta `usuarioID` en modo dev) |

| Variable de entorno | Default | Uso |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Parámetro `ClaudeApiKey` del stack (`CLAUDE_API_KEY` en `deploy.sh`) |
| `MODELO_LLM` | `claude-opus-5-5` | Modelo de Claude |
| `ESFUERZO_LLM` | `low` | `output_config.effort` (`low`, `medium`, `high`) |
| `TIMEOUT_LLM_MS` | `22000` | Corte de la llamada al LLM (API Gateway corta a los 30 s) |
| `MARGEN_OBJETIVO_DEFECTO` | `0.6` | Si el negocio no tiene `margenObjetivo` en Configuración ni en el producto |
| `MARGEN_MINIMO` | `0.3` | Piso de margen que ninguna sugerencia puede perforar |
| `TOPE_SUBA_PCT` | `0.25` | Suba máxima por ajuste |
| `VENTANA_HISTORIAL_DIAS` | `90` | Historial de compras considerado |
