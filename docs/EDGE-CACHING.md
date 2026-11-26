# ADR: Edge caching con CloudFront para las lecturas de clima y demanda

**Estado:** Aceptada · **Fecha:** 26/11/2026 · **Rama:** `feat/edge-caching` · **Entrega 3, Persona 5**

## Contexto

La consigna pide *"configurar caché en API Gateway / CDN para reducir la latencia de las lecturas repetidas del dashboard y clima"*.
La API es una **HTTP API** de API Gateway (`1i2vqeifsi`, us-east-2), que **no tiene caché propia**: la caché de etapa
solo existe en las REST API. Medido desde Argentina, cada lectura tarda unos 0,65 s en caliente y entre 1,6 y 6,6 s
cuando la Lambda arranca en frío.

## Decisión

**Una distribución de CloudFront (`d2nm15i6i0na2r.cloudfront.net`) delante de la API, que cachea solo las lecturas
que toleran datos de unos minutos.** El resto de las rutas sigue yendo directo a la API.

| Comportamiento | Política de caché | TTL | Motivo |
|---|---|---|---|
| `/clima` | `medianube-clima-30min` | 1800 s (máx. 3600) | El pronóstico se refresca una vez por día (05:00 ART). |
| `/demanda` | `medianube-demanda-5min` | 300 s (máx. 600) | La predicción cambia de noche (05:30) o al recalcular. |
| `*` (predeterminado) | `CachingDisabled` | — | Por si alguna ruta llega a CloudFront: pasa sin caché. |

- **Clave de caché:** solo las query strings `usuarioID` y `_`. Cada usuario tiene su entrada, y `_` permite pedir la
  versión fresca. Sin cabeceras ni cookies. Compresión Gzip y Brotli.
- **Origen:** `AllViewerExceptHostHeader`. Se reenvía todo menos `Host`, que tiene que ser el de API Gateway.
- **CORS:** la política de respuesta `SimpleCORS` agrega `Access-Control-Allow-Origin: *` también a las respuestas
  servidas desde la caché. Sin ella, una respuesta cacheada a partir de un pedido sin `Origin` (por ejemplo, `curl`)
  quedaba sin la cabecera y el navegador la habría bloqueado. Se detectó al probar la distribución.
- **Clase de precio:** todas las ubicaciones, porque es la única que incluye Sudamérica (los aciertos salen de EZE50,
  Ezeiza). Sin WAF: la seguridad perimetral es la tarea de Persona 4.
- **Frontend:** `lib/api.ts` suma `cdnUrl()` (base `NEXT_PUBLIC_CDN_URL`; por defecto, esta distribución) y `sinCache()`,
  que agrega `_=<timestamp>`. Pasan por CloudFront la URL de `/demanda` (Demanda y Dashboard) y la de `/clima` (Demanda).
  "Actualizar", "reintentar" y la recarga después de registrar una venta usan `sinCache`, así no muestran datos viejos.
  Si se configura otra API con `NEXT_PUBLIC_API_URL` y no hay `NEXT_PUBLIC_CDN_URL`, no se cachea: las lecturas van a
  esa misma API.

## Resultado (26/11/2026, 10 lecturas desde Argentina)

| Lectura | Directo a API Gateway | Por CloudFront | Mejora (mediana) |
|---|---|---|---|
| `GET /clima` | mediana 632 ms (606–689) | mediana **57 ms** (45–61) | ≈ 11× |
| `GET /demanda` | mediana 677 ms (611–1666) | mediana **64 ms** (52–586*) | ≈ 10× |

\* El máximo de 586 ms es un *miss*: el TTL de 5 min había vencido y CloudFront fue a buscar los datos a la API.
En el navegador, el Dashboard lee `/demanda` en unos 45 ms, mientras que `/precios/sugerir` y `/compras` (sin caché)
tardan entre 1,4 y 2,4 s. Los aciertos se reconocen por la cabecera `X-Cache: Hit from cloudfront`.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Pasar a REST API para usar la caché de API Gateway | Habría que rehacer a mano todas las rutas, integraciones y authorizers a días de la defensa. |
| Solo `Cache-Control` en las Lambdas | Es caché del navegador, no del edge: no ayuda a otros usuarios ni evita los arranques en frío. |
| Poner toda la API detrás de CloudFront | Las rutas con token o escritura no se cachean, y cambiar la base de todas las llamadas arriesgaba el resto de la app. |
| Cachear `GET /precios/sugerir` | Después de aplicar un precio, volver a Precios mostraría la sugerencia vieja. |
| Invalidaciones de CloudFront al recalcular | Tardan y se cobran a partir de 1000 por mes; el parámetro `_` resuelve lo mismo para quien recalcula. |

## Consecuencias

- Otro usuario puede ver la predicción hasta 5 minutos vieja después de que alguien recalcula. Es aceptable para una
  planificación diaria. Quien recalcula ve el dato fresco.
- Mientras Demanda y Clima sigan con `?usuarioID=user_test_123`, la clave de caché usa ese parámetro. Cuando pasen a
  JWT (tarea 9), hay que **sacar estas rutas de la caché o agregar la identidad a la clave**: si no, CloudFront podría
  servir la respuesta de un usuario a otro.
- Costo: dentro de la capa gratuita de CloudFront (1 TB y 10 millones de pedidos por mes).
- La distribución se creó a mano en la consola (sin CloudShell); queda fuera de `template.yaml`, como el resto de lo
  desplegado manualmente (ver `docs/DESPLIEGUE-MANUAL.md`).
