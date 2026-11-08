# Guía: usar el clima y la predicción de demanda desde otra Lambda

Para quien arma la **sugerencia de producción** (motor predictivo con LLM). Explica qué datos de clima
y de demanda ya genera el backend, dónde quedan y cómo leerlos.

## Qué hay y cuándo se actualiza

| Hora (ART) | Qué corre | Dónde queda |
|---|---|---|
| 05:00 | `obtenerClima-dev` refresca el pronóstico de 7 días de cada usuario con ubicación | `Medianube-Clima` |
| 05:30 | `predecirDemanda-dev` estima la demanda de hoy a hoy+6 por producto, ajustada por lluvia | `Medianube-Predicciones` |

Tu Lambda puede correr después de las 05:30 o a pedido. En los dos casos encuentra el clima y la
predicción del día ya calculados.

## `Medianube-Clima`: pronóstico por día

- **Clave:** `usuarioID` (partición) + `fecha` (orden, `YYYY-MM-DD`). Es una fila por usuario y día.
- **Vencimiento:** los ítems se borran solos a los 14 días (TTL en `expiraEn`).

```json
{
  "usuarioID": "user_test_123",
  "fecha": "2026-11-08",
  "tempMax": 24.1, "tempMin": 12.4,
  "precipitacionMm": 0, "probLluvia": 5,
  "codigoClima": 1, "descripcion": "Mayormente despejado",
  "actualizadoEn": "2026-11-08T08:00:03.000Z",
  "expiraEn": 1795334403
}
```

Cualquier valor numérico puede venir en `null` si Open-Meteo no lo informó.

## `Medianube-Predicciones`: demanda estimada por día y producto

- **Clave:** `usuarioID` + `fechaProducto`, donde `fechaProducto` es `<YYYY-MM-DD>#<productoID>`.
- **Para qué te sirve:** úsala como insumo del prompt en lugar de recalcular la demanda. Ya tiene en cuenta
  el patrón semanal (8 semanas de ventas) y la lluvia.

```json
{
  "usuarioID": "user_test_123",
  "fechaProducto": "2026-11-08#medialuna-manteca",
  "fecha": "2026-11-08", "productoID": "medialuna-manteca", "nombre": "Medialunas de manteca (u.)",
  "cantidad": 274, "base": 322.03, "factorClima": 0.85,
  "confianza": "alta", "observaciones": 8, "precisionPct": 0.954,
  "versionModelo": "demanda-v1", "generadaEn": "2026-11-08T08:30:00.000Z"
}
```

| Campo | Significado |
|---|---|
| `cantidad` | Unidades sugeridas: `base × factorClima`, redondeado hacia arriba |
| `base` | Promedio ponderado del mismo día de la semana |
| `factorClima` | `0.85` si se pronostica lluvia, `1` si no, `null` si no había pronóstico |
| `confianza` | `alta`, `media` o `baja`, según la cantidad de datos y su dispersión |
| `precisionPct` | Precisión del modelo para ese producto en los últimos 7 días (0 a 1) |

Detalle del modelo: [PREDICCION-DEMANDA.md](PREDICCION-DEMANDA.md).

## Cómo leerlos desde tu Lambda (Node.js)

El AWS SDK v3 ya viene en el runtime de Lambda: no hace falta empaquetarlo.

```js
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

// Fuera del handler: se reutiliza entre invocaciones.
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// "Hoy" en Argentina, no en UTC: a las 23:30 ART en UTC ya es el día siguiente.
const hoyAR = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
const sumarDias = (fecha, n) => {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
};

export async function leerClima(usuarioID, dias = 7) {
  const hoy = hoyAR();
  const { Items = [] } = await db.send(new QueryCommand({
    TableName: "Medianube-Clima",
    KeyConditionExpression: "usuarioID = :u AND fecha BETWEEN :desde AND :hasta",
    ExpressionAttributeValues: { ":u": usuarioID, ":desde": hoy, ":hasta": sumarDias(hoy, dias - 1) },
  }));
  return Items; // puede venir vacío: ver "Qué tenés que tolerar"
}

export async function leerPredicciones(usuarioID, fecha = hoyAR()) {
  const { Items = [] } = await db.send(new QueryCommand({
    TableName: "Medianube-Predicciones",
    KeyConditionExpression: "usuarioID = :u AND begins_with(fechaProducto, :f)",
    ExpressionAttributeValues: { ":u": usuarioID, ":f": `${fecha}#` },
  }));
  return Items; // una fila por producto con ventas para ese día
}
```

### Alternativa: `GET /clima`

Si preferís no leer la tabla, está
`GET https://1i2vqeifsi.execute-api.us-east-2.amazonaws.com/clima?usuarioID=<id>`. Responde **siempre 200**,
aunque Open-Meteo esté caído:

```json
{ "origen": "cache | open-meteo | sin-datos", "disponible": true, "desactualizado": false,
  "aviso": null, "dias": [ { "fecha": "2026-11-08", "tempMax": 24.1, "...": "..." } ] }
```

Con `disponible: false`, `dias` viene vacío. Leer la tabla es más rápido y no depende de API Gateway.

## Qué tenés que tolerar

- **Clima vacío o viejo:** si no hay filas para hoy o `actualizadoEn` tiene más de un día, el prompt tiene
  que funcionar igual sin clima y bajar la confianza de la sugerencia.
- **Ubicación por defecto:** el onboarding todavía no guarda la ubicación del negocio. Mientras tanto, el
  pronóstico es de La Plata para todos los usuarios.
- **Productos sin predicción:** solo se predicen los productos con ventas registradas en
  `Medianube-Ventas`. Un producto nuevo no aparece en `Medianube-Predicciones`.

## Permisos

- **Con `LabRole` (AWS Academy):** ya tiene acceso, no hay que tocar nada.
- **Con un rol propio:** necesita `dynamodb:Query` sobre `arn:aws:dynamodb:us-east-2:<cuenta>:table/Medianube-Clima`
  y `.../table/Medianube-Predicciones`.

## Datos de prueba

Desde CloudShell, en `backend/`, después de `./scripts/deploy.sh`:

```bash
./scripts/preparar-demo.sh                 # user_test_123 en La Plata
```

Carga ubicación, productos con receta, facturas y 8 semanas de ventas, y corre `obtenerClima` y
`predecirDemanda`. Al final muestra cuántas filas quedaron en cada tabla.

## Pendientes de otros integrantes

- **Persona 2:** guardar `ubicacion: { ciudad, lat, lon }` en `Medianube-Configuracion` desde el onboarding
  y la configuración, usando `UpdateItem` y no `PutItem`, para no borrar otros atributos.
- **Unificar nombres:** la configuración guarda `margenes`, pero el motor de precios lee `margenObjetivo`.
