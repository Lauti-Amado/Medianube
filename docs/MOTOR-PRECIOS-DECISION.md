# ADR: Motor de precios oficial (Gemini desplegado vs. Claude del repositorio)

**Estado:** Aceptada · **Fecha:** 15/11/2026 · **Rama:** `docs/decision-motor-precios`
**Reemplaza a:** la decisión de proveedor de [`MOTOR-PRECIOS.md`](MOTOR-PRECIOS.md) (31/10/2026). Ese documento queda como referencia del diseño original.

## Contexto

Hoy conviven dos implementaciones de `POST /precios/sugerir`:

1. **Motor con Claude** (`backend/src`, rama `feat/motor-precios`, 31/10). Tiene arquitectura hexagonal y tests, y está documentado en `MOTOR-PRECIOS.md`. Recibe el ticket de una factura y lo compara con el historial. **Nunca se desplegó**: `deploy.sh` depende de CloudShell, que estaba bloqueado.
2. **Motor con Gemini** (Lambda `sugerirPrecios-dev`, creada a mano en la consola). Lee las tablas `Producto`, `Receta-nueva` y `Gastos`, calcula costos, le pide precios a Gemini y guarda la sugerencia en `Sugerencia-precio`. Además tiene `POST /precios/aplicar`. **Es la que está desplegada**, y la pantalla `/precios` está conectada a ella (commit `2341e24`).

Tener dos motores confunde. La documentación y el `template.yaml` describen el de Claude, mientras que el que responde es el de Gemini. Además, el `template.yaml` crea la Lambda con el nombre `sugerirPrecios-${Entorno}` = `sugerirPrecios-dev`, **el mismo que la de Gemini**: un `deploy.sh` la pisaría.

## Decisión

**El motor oficial es el de Gemini (`sugerirPrecios-dev`).** El motor con Claude se archiva, y de él se portan a la Lambda de Gemini las piezas que le faltan (ver "Plan de portado").

## Comparación

| Aspecto | Motor con Claude (repo) | Motor con Gemini (desplegado) |
|---|---|---|
| Estado | Sin desplegar | En producción, conectado al front |
| Proveedor y costo | API de Claude, requiere key paga | Gemini con nivel gratuito; la misma key que usa el OCR (`procesarFactura`) |
| Entrada | El ticket de una factura (`{ ticket: { items } }`) | Nada: lee las tablas completas |
| Costos | Dominio puro, normaliza presentaciones a kg/l/u y empareja descripciones por similitud + LLM | Dentro de la Lambda: busca la última compra por `categoria` igual al nombre del ingrediente y convierte unidades |
| Guardas | Margen objetivo 60%, mínimo 30% y tope de suba 25% (regla dura: si se supera, gana el tope) | Los mismos valores. El mínimo es regla dura; el tope solo marca `superaTopeSuba` y baja la confianza |
| Si el LLM falla | Respaldo por reglas: responde 200 con `origen: "reglas"` y `degradado: true` | **Responde 500** |
| Márgenes por negocio | Lee `margenObjetivo` de la configuración del usuario | Fijos en el código (`MARGEN_OBJETIVO = 0.60`) |
| Usuario | Filtra por `usuarioID` | No filtra: tablas globales |
| Persistencia | Atributo `sugerencia` en `Medianube-Productos` (tabla que no existe) | Tabla `Sugerencia-precio`, con estado por producto |
| Aplicar precio | No existe | `POST /precios/aplicar`, transaccional (`Producto` + `Sugerencia-precio`) y protegido contra doble aplicación |
| Tests | Unitarios del dominio, caso de uso y adaptadores | Ninguno |
| Código en el repo | Sí | Todavía no (tarea pendiente) |

## Motivos

1. **Funciona de punta a punta en producción.** El front ya está conectado, y "aplicar precio" actualiza `Producto` de forma transaccional. El motor con Claude no tiene ese flujo.
2. **No requiere una key paga.** Gemini se usa con el nivel gratuito y ya está en la cuenta para el OCR.
3. **Tiempo.** Faltan 15 días para la defensa (30/11). Desplegar el motor con Claude implica crear tablas que no existen (`Medianube-Productos`, `Medianube-Facturas`), cambiar el contrato del front y reescribir "aplicar precio".
4. **Las guardas ya coinciden.** Los márgenes y el tope son los mismos, así que el comportamiento de negocio no cambia.

## Consecuencias

**Lo que se pierde por ahora**, y se recupera con el plan de portado:
- el respaldo por reglas cuando el LLM falla;
- los márgenes configurables por negocio;
- el filtro por usuario;
- el emparejamiento por similitud de las descripciones de factura;
- los tests.

**Cambios en el repositorio** (tarea "ordenar el repo para que coincida con AWS"):
- Versionar el código de `sugerirPrecios-dev` en el repo.
- Mover el motor con Claude a `backend/archivo/precios-claude/` y sacarlo de `scripts/build.mjs`, junto con sus tests.
- En `template.yaml`, quitar `FuncionSugerirPrecios` y el parámetro `ClaudeApiKey`. Mientras eso no esté hecho, **no correr `deploy.sh`**.
- La métrica `CaidasClaude` deja de aplicar. Si se porta el respaldo, se reemplaza por una equivalente para Gemini.

## Plan de portado

| # | Qué se trae del motor con Claude | Prioridad |
|---|---|---|
| 1 | **Respaldo por reglas si Gemini falla o tarda.** Precio por margen objetivo, con mínimo, tope y redondeo; `origen: "reglas"` y `degradado: true`. El front ya muestra el aviso "calculado sin IA". | Alta |
| 2 | **`GET /precios/sugerir`** devuelve la última sugerencia guardada, sin llamar a Gemini. La ruta ya existe, pero hoy responde 405. Lo usan la pantalla de Precios al entrar y el Dashboard. | Alta |
| 3 | **Márgenes por categoría** desde `Medianube-Configuracion`, en lugar del 60% fijo. Depende de `GET`/`PUT /configuracion`. | Media |
| 4 | **Facturas → costos.** `procesarFactura` guarda los ítems con cantidad y unidad, y el motor los usa (puede reaprovechar la normalización de presentaciones de `domain/precios/reglas.ts`). | Media |
| 5 | **Filtro por usuario**, cuando las tablas tengan `usuarioID`. | Media |
| 6 | **Tests** de las funciones puras de la Lambda (costos, conversión de unidades, validación de sugerencias). | Baja |

## Contrato vigente (Lambda `sugerirPrecios-dev`)

### `POST /precios/sugerir`

**Cuerpo:** vacío o `{}`. La Lambda lee los datos de DynamoDB.

**Respuesta 200:**

```json
{
  "success": true,
  "mensaje": "Sugerencias generadas correctamente.",
  "sugerenciaPrecioID": "sug-…",
  "fechaGeneracion": "2026-11-13T23:45:00.000Z",
  "estado": "pendiente",
  "cantidadProductosAnalizados": 7,
  "cantidadSugerencias": 7,
  "cantidadProductosSinCosto": 0,
  "sugerencias": [
    {
      "productoID": "te-con-leche", "nombre": "Te con leche", "unidadProducto": "vaso",
      "precioActual": 1318, "costoActual": 527.2, "costoAnterior": null, "variacionCosto": null,
      "precioSugerido": 1318, "variacionPrecio": 0, "margenResultante": 60,
      "razonamiento": "…", "confianza": "alta", "superaTopeSuba": false
    }
  ],
  "productosSinCosto": [ { "productoID": "…", "motivo": "…" } ]
}
```

**Errores:** 500 `{ success: false, error }` si faltan datos (recetas, productos o gastos), si ningún producto tiene costo calculable o si Gemini falla. Lo último se corrige con el ítem 1 del portado.

### `POST /precios/aplicar`

**Cuerpo:** `{ "sugerenciaPrecioID": "sug-…", "productoID": "te-con-leche" }`

**Respuesta 200:** `{ success, mensaje, sugerenciaPrecioID, productoID, precioAnterior, precioNuevo, fechaAplicacion, estadoAplicacion: "aplicada", estadoSugerencia: "parcial" | "aplicada" }`

**Errores:**
- 400: faltan datos.
- 404: no existe la sugerencia, o el producto no está en ella.
- 409: el precio ya se aplicó, o el precio actual cambió desde que se generó la sugerencia.

### Tablas y variables

- **Tablas:** `Receta-nueva`, `Producto`, `Gastos` y `Sugerencia-precio`.
- **Variables:** `TABLA_RECETAS`, `TABLA_PRODUCTOS`, `TABLA_GASTOS`, `TABLA_SUGERENCIAS`, `GEMINI_API_KEY`, `MODELO_GEMINI` y `CORS_ORIGIN`.

## Alternativas descartadas

| Alternativa | Motivo |
|---|---|
| Desplegar el motor con Claude y retirar el de Gemini | Requiere key paga, tablas nuevas, cambiar el contrato del front y reescribir "aplicar precio". No llega a la defensa. |
| Mantener los dos motores | Dos fuentes de verdad, documentación contradictoria y riesgo de pisar la Lambda desplegada con `deploy.sh`. |
| Cambiar el proveedor de la Lambda de Gemini a Claude | Suma el costo de la key sin resolver lo que realmente falta (respaldo, márgenes y usuario), que no depende del proveedor. |
