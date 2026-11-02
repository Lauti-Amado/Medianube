# ADR: Predicción de demanda nocturna con EventBridge

**Estado:** Aceptada · **Fecha:** 01/11/2026 · **Rama:** `feat/Cronjob`

## Contexto

Medianube promete predecir la demanda de producción, pero hasta ahora no había ningún modelo:
`Medianube-Predicciones` existía y nadie escribía en ella, y `/demanda` usa datos de prueba.
Las panaderías planifican la producción a primera hora, así que la predicción tiene que estar lista
antes de abrir y sin que nadie apriete un botón.

## Decisión

**Una Lambda `predecirDemanda` con un modelo estadístico, disparada todos los días a las 05:30 ART por
una regla de EventBridge.**

```
05:00 ART  medianube-refresco-clima-<env>      → obtenerClima: pronóstico de 7 días en Medianube-Clima
05:30 ART  medianube-prediccion-demanda-<env>  → predecirDemanda, para cada usuario:
             Ventas (8 semanas + 7 días)  ─┐
             Clima (hoy … hoy+6, cache)   ─┼─► modelo demanda-v1 ─► Medianube-Predicciones
             Productos (nombre)           ─┘                         SK <fecha>#<productoID>, TTL 30 días
```

### Modelo `demanda-v1` (`backend/src/domain/demanda/modelo.ts`)

| Paso | Regla |
|---|---|
| Base | Promedio ponderado de las ventas del **mismo día de la semana** en las últimas 8 semanas. Cada semana pesa 0,8 veces la siguiente más reciente. |
| Clima | Si el pronóstico del día trae lluvia (probabilidad ≥ 60 % o ≥ 2 mm), × 0,85. Sin pronóstico, × 1. |
| Cantidad | `ceil(base × factor)`: se redondea hacia arriba porque quedarse corto cuesta más que sobrar una unidad. |
| Días sin venta | Cuentan como 0, pero solo a partir de la primera venta del producto, para no castigar a un producto nuevo. |
| Confianza | Alta con ≥ 6 observaciones y coeficiente de variación < 0,25; media con ≥ 3 y < 0,5; si no, baja. Sin clima baja un nivel. |
| Precisión | Backtest: se predicen los últimos 7 días reales con la información previa y se calcula 1 − wMAPE. Se guarda por producto (`precisionPct`) para el KPI "precisión del modelo". |

### Programación

| Decisión | Motivo |
|---|---|
| Regla clásica de EventBridge (`AWS::Events::Rule`), no EventBridge Scheduler | Scheduler necesita un rol IAM propio para invocar la Lambda, y en AWS Academy no se pueden crear roles. Es el mismo criterio que la regla de clima. |
| `cron(30 8 * * ? *)` (UTC) = 05:30 ART | Argentina no tiene horario de verano, así que el offset UTC−3 es fijo. Media hora después del refresco de clima, para usar el pronóstico recién actualizado. Es configurable con el parámetro `CronPrediccion`. |
| Timeout de 300 s, usuarios en serie | Sin API Gateway no rige el límite de 30 s. En serie se respeta la concurrencia reservada y la capacidad On-Demand. Un usuario que falla no corta la corrida. |
| `EventInvokeConfig`: 1 reintento, máximo 1 h | Solo se reintenta si falla la corrida entera (por ejemplo, no se pudo listar usuarios). Es seguro porque la escritura es idempotente: misma clave, mismo día. |
| Predecir solo "hoy … hoy+6" con ventas hasta ayer | A la madrugada todavía no hay ventas del día. |

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| LLM para predecir | Es caro y no determinístico para una corrida nocturna sobre todos los usuarios, y un número que no se puede reproducir es difícil de explicar. Queda como opción para *explicar* la predicción en v2. |
| SageMaker o Forecast | Suelen estar bloqueados en Learner Lab y necesitan meses de historial que todavía no hay. |
| Calcular a pedido cuando se abre `/demanda` | La pantalla tendría que esperar la lectura de 8 semanas de ventas, y la corrida nocturna deja el resultado precalculado. |

## Consecuencias

- **Pendiente de confirmar:** todavía no hay un productor oficial de `Medianube-Ventas`. Se asume una fila por
  día y producto con `cantidad`. El adaptador también acepta `unidades` y `cantidadVendida`, y si faltan los
  atributos toma la fecha y el producto de la SK.
- El frontend sigue con mocks. Para conectarlo alcanza una consulta por `usuarioID` y `fechaProducto BETWEEN hoy AND hoy+6`.
  Un botón "recalcular con IA" puede reusar `predecirUsuario` detrás de una ruta HTTP.
- Para evolucionar a v2: aprender el efecto real de la lluvia con el histórico de clima (hoy la cache dura
  14 días), sumar feriados y comparar cada día la predicción guardada contra la venta real. Hay que subir
  `VERSION_MODELO` en cada cambio.
