# Plan de mejora UX/UI — medianube

Plan por etapas para mejorar la experiencia y la interfaz de las 9 pantallas del frontend, **sin cambiar la identidad visual**: se mantienen la paleta crema/caramelo/espresso, Work Sans, el logo, la ausencia de sombras y los radios actuales. El único ajuste de color es el acento caramelo, un tono más profundo para cumplir accesibilidad (ítem 0.15, confirmado). Los cambios son de jerarquía, simplificación, copy, estados y consistencia.

- **Fuente de verdad visual:** [`docs/UXUI/DESIGN.md`](../DESIGN.md) (tokens, principios y especificación por pantalla). Muchas mejoras de este plan son, en realidad, volver a alinear la implementación con lo que ese documento ya define.
- **Skills aplicadas:** `impeccable` (heurísticas de Nielsen, carga cognitiva, estados, copy, accesibilidad, modo *Operate* para UI de producto) y `frontend-design` (tipografía, estructura visual con significado, escritura de interfaz, restricción).
- **Previsualizaciones:** [`png/`](png/). Cada pantalla tiene dos versiones: `NN-pantalla.png` con **marcadores numerados** que coinciden con los ítems de su etapa, y `NN-pantalla-limpio.png` sin marcadores. Las fuentes HTML de los mockups están en [`mockups/`](mockups/) por si se quieren ajustar.
- **Alcance:** solo escritorio. Este documento es plan + mockups; no se tocó código del frontend.

### Cómo leer cada ítem

| Tipo | Significa |
|---|---|
| **Quitar** | El elemento no aporta o duplica información. Se elimina. |
| **Simplificar** | Se mantiene la función pero con menos piezas visuales. |
| **Agregar** | Falta algo (estado, feedback, popup, ayuda). |
| **Resaltar** | Hay información importante que hoy pasa desapercibida. |
| **Corregir** | Bug visual, de accesibilidad, de consistencia o de datos. |

Prioridad: **P0** bloquea la tarea · **P1** confunde o puede causar errores (resolver primero) · **P2** molestia con salida alternativa · **P3** pulido.

`📍n` = marcador visible en el PNG de esa pantalla. ✅ = ítem ya resuelto (total o parcialmente) en `main`.

### Cambios de `main` incorporados al plan (13/11/2026)

Después de escribir la primera versión del plan entraron a `main` cambios de otro integrante del equipo (PR #98 a #108). Los que tocan la interfaz son dos pantallas; el resto es backend, infraestructura y documentación:

| Pantalla | Qué cambió en `main` | Cómo se adaptó el plan |
|---|---|---|
| **Subir factura** | Ítems reales leídos por la IA en lugar de ejemplos, estado de "procesando" y botón en dos pasos ("Subir y extraer datos" → "Confirmar y guardar"). | Ítems 2 y 4 marcados como resueltos en parte. Se agregó el ítem 11 ("Confirmar y guardar" no guarda las correcciones) y se reescribieron el 3, el 5 y el 10. Hay una vista nueva: `06c-subir-leyendo.png`. |
| **Demanda** | Datos reales de `GET /demanda`, gráfico solo con la predicción, botón "Actualizar" y pronóstico del clima. | Ítem 4 resuelto, ítems 3, 6 y 8 en parte. El 5 pasó a P1 (la tabla mezcla días) y se sumaron el 9 (clima integrado al gráfico) y el 10 (color de los días de lluvia). El mockup `08-demanda.png` se rehízo sobre la pantalla nueva. |

Ningún cambio de `main` contradice la Etapa 0 ni el cambio de paleta (0.15).

---

## Diagnóstico general

**Lo que ya funciona y hay que conservar**

- La identidad es coherente y propia: crema + caramelo + sidebar espresso se siente panadería sin caer en decoración. El logo circular y el wordmark en minúscula funcionan.
- La regla "sin sombras, bordes de 1px" está aplicada en todas partes y le da un aspecto limpio.
- Los estados casi siempre combinan color + texto (procesada / revisar, confianza alta / media / baja), como pide el `DESIGN.md`.
- Los flujos de acceso (login, registro con verificación, recuperar contraseña) están completos y con mensajes de error en castellano.

**Los problemas que se repiten en todas las pantallas**

1. **Pesos tipográficos falsos.** `layout.tsx` carga Work Sans solo en 400 y 500, pero el código usa `fontWeight: 600` y `700` en títulos, KPIs, sidebar y tarjetas de precios. El navegador "inventa" esa negrita (faux bold), que se ve más borrosa y despareja. El `DESIGN.md` pide dos pesos: 400 y 500.
2. **Mayúsculas con tracking por todos lados** ("COMPRAS RECIENTES", "PRODUCCIÓN TOTAL PREVISTA", "NAVEGACIÓN", encabezados de tabla). Contradice el `DESIGN.md` (sentence case en toda la interfaz) y es la marca más típica de interfaz genérica.
3. **Demasiados botones primarios.** El `DESIGN.md` pide una acción de acento sólido por pantalla. Hoy Precios tiene 8 botones sólidos, el Dashboard 4 y Compras 3.
4. **Jerga técnica a la vista del usuario:** "Lambda", "DynamoDB", "Gemini", "modelo v2.4", "ID: sug-4e19a695…", "tablas Producto y Receta-nueva", "Estado: completed", "Cargando datos desde la nube".
5. **Acciones con plata sin confirmación.** "Aplicar precio" cambia el precio de venta con un clic, sin mostrar el antes y el después ni permitir deshacer.
6. **Datos que se contradicen entre pantallas.** El Dashboard saluda a "Panadería La Espiga" y Configuración dice "Panadería Central". El Dashboard muestra 2 alertas de precio y Precios dice 0. Producción prevista dice 2.180 u. en el Dashboard (mock) y otro número en Demanda (datos reales).
7. **Contraste insuficiente.** `text-secondary` (#8C7361) sobre el fondo crema da 3,98:1 y `text-muted` (#B08D6F) da 2,74:1. Ambos quedan por debajo del mínimo AA (4,5:1) y se usan para subtítulos y textos de ayuda. Además, el texto blanco sobre el acento caramelo (#B5722E) de los botones primarios da 3,9:1.

**Puntaje heurístico estimado (Nielsen, 0–4):** 22/40, **Aceptable**. Los puntos más bajos son *prevención de errores* (1), *consistencia* (2), *diseño minimalista* (2) y *correspondencia con el mundo real* (2, por la jerga técnica).

---

## Etapa 0 · Fundamentos compartidos

> Se hace primero. Corrige de una vez lo que se repite en todas las pantallas, así las etapas siguientes son más chicas. Previsualización: [`00-componentes.png`](png/00-componentes.png).

| # | Tipo | Qué | Por qué | Prio |
|---|---|---|---|---|
| 0.1 | Corregir | Usar solo pesos **400 y 500**. Reemplazar todos los `600` y `700`. Los títulos de pantalla pasan a 500. | Elimina la negrita falsa y respeta el `DESIGN.md` §3.2. Si algún KPI necesitara más peso, cargar 600 en `layout.tsx` en vez de dejar que el navegador lo simule. | P1 |
| 0.2 | Simplificar | **Sentence case en todo**: labels de KPI, encabezados de tabla, títulos de sección y botones. Sin `textTransform: uppercase` ni `letterSpacing` extra. | Tono cálido y conversacional (§3.2), menos ruido visual y más legibilidad en tamaños chicos. | P2 |
| 0.3 | Corregir | **Jerarquía de botones**. *Primario*: acento sólido, uno por pantalla. *Secundario*: borde. *Terciario*: texto en acento. *Informativo*: texto apagado, sin cursor pointer (p. ej. "al día"). | Hoy compiten 3 a 8 botones sólidos por pantalla y el ojo no sabe qué hacer primero. | P1 |
| 0.4 | Simplificar | **Badge único**: pill (radio completo), 11px/500 y siempre con texto. Quitar los glifos unicode `✓` `⚠` de la tabla de factura. | Hoy conviven badges de radio 6px y pills, y algunos tienen emoji. Un solo componente es más predecible. | P2 |
| 0.5 | Quitar | **Bordes izquierdos gruesos de color** (3–4px) en tarjetas de precios y banners, y la barra de 2px en títulos de sección del Dashboard. Reemplazarlos por borde de 1px del color de estado más un ícono. | Es decoración que no agrega información: el estado ya lo dice el badge. Además ensucia la grilla. | P2 |
| 0.6 | Corregir | **Marca de IA unificada**: el ícono de sparkles más el badge "IA" se usan *solo* en contenido generado por IA. Quitarlo de la fecha del Dashboard y del aviso de inflación del onboarding. Reemplazar "Gemini" y "modelo v2.4" por "IA". | Principio 2 del `DESIGN.md`: si el sparkle aparece en cualquier lado, deja de significar "esto lo calculó la IA". | P1 |
| 0.7 | Corregir | **Sin jerga técnica** en la interfaz. Ver la tabla de copy al final de cada etapa. | El usuario es dueño de una panadería, no desarrollador. | P1 |
| 0.8 | Corregir | **Contraste del texto**. `text-secondary` pasa de `#8C7361` a `#7D6453` (4,9:1 sobre crema, 5,5:1 sobre blanco). El texto de los badges neutros pasa a `#6E5646` (sobre `#F0E4D4`, el actual da 4,4:1). `text-muted` queda solo para placeholders y deshabilitados, nunca para información que haya que leer ("al día", "leyendo…" pasan a `text-secondary`). | Cumple AA. El cambio de tono es casi imperceptible y no altera la paleta. | P1 |
| 📍0.15 | Corregir | **Contraste del acento** ✅ *confirmado el 13/11/2026*. El blanco sobre `#B5722E` da 3,9:1 (botones primarios y CTA del sidebar) y el acento como texto chico sobre blanco también da 3,9:1 (links). **Cambio:** el acento pasa a `#A4651F` (4,7:1 con blanco, mismo matiz caramelo, un tono más profundo) y los links y textos chicos en acento usan `accent-dark` (`#8A5423`, 6,2:1). **Al implementar:** en `globals.css` cambiar `--color-accent` y `--color-sidebar-upload-bg` a `#A4651F`, pasar a `--color-accent-dark` los links y textos que hoy usan `--color-accent`, y actualizar la tabla de color del `DESIGN.md` (§3.1). Los iconos, el anillo de foco y las barras de progreso pueden seguir en `accent` porque no son texto. Los mockups ya usan el color nuevo. | Es la combinación más usada de la interfaz y no cumplía AA. Agrandar la letra no alcanza: el umbral de "texto grande" es de 18,66px en negrita. | P1 |
| 0.9 | Corregir | **Números**: `font-variant-numeric: tabular-nums`, alineados a la derecha en tablas y un solo formato de moneda (`$1.318`, sin espacio). Hoy Precios usa `$ 2.500` y el Dashboard `$850`. | Las columnas de plata se comparan mejor si los dígitos se alinean. | P2 |
| 0.10 | Agregar | **Feedback consistente**: *toast* para confirmar acciones (con "deshacer" cuando se puede), *diálogo de confirmación* solo para acciones irreversibles o con plata, y *skeletons* en lugar de "..." o "Cargando…". | Hoy cada pantalla resuelve el feedback distinto (texto suelto, banner verde, nada). | P1 |
| 0.11 | Simplificar | **Encabezado de pantalla único** (`PageHeader`): título 20px/500 en `text-primary`, subtítulo opcional 13px y acción a la derecha. Quitar el `#2C1A0E` y los 24px/700 hardcodeados del Dashboard. | Cada pantalla hoy tiene un título de distinto tamaño, peso y color. | P2 |
| 0.12 | Simplificar | **Sidebar**. Quitar la etiqueta "NAVEGACIÓN" (no aporta). Marcar como activo "Configuración" cuando se está ahí (hoy nunca se marca). "Subir factura" queda como el CTA global, así que no se repite en los encabezados de Dashboard y Compras. | Menos duplicación y orientación correcta. | P2 |
| 0.13 | Corregir | **Componentizar** los estilos inline repetidos: `Button`, `Badge`, `Card`, `KpiCard`, `PageHeader`, `Toast`, `ConfirmDialog`, `Skeleton`, `PasswordRequirements`. | Hoy los mismos estilos están copiados en cada página, con pequeñas diferencias entre sí. Es la causa de casi todas las inconsistencias. | P2 |
| 0.14 | Corregir | **Datos coherentes** entre pantallas: el nombre del negocio sale de la cuenta y los mocks se alinean entre sí (ver "Inconsistencias de datos" al final). | Un número que cambia según la pantalla destruye la confianza en la IA. | P1 |

---

## Etapa 1 · Login — `/login`

**Objetivo:** entrar rápido y con confianza. Previsualización: [`01-login.png`](png/01-login.png) muestra el estado normal y el estado de error.

| # | Tipo | Qué | Por qué | Prio |
|---|---|---|---|---|
| 📍1 | Quitar | El subtítulo "SOFTWARE" debajo del wordmark. El logo y el wordmark no se tocan. | Es un texto de relleno en mayúsculas que no informa nada. | P3 |
| 📍2 | Simplificar | "¿olvidaste tu contraseña?" alineado a la derecha, en la misma línea que el label "contraseña" (como pide el §5.1). | Se encuentra donde el usuario lo busca y ahorra una línea vertical. | P3 |
| 📍3 | Corregir | Banner de error con los tokens `warning-bg` y `warning-text` en vez de `rgba(239,68,68)`, que es un rojo fuera de la paleta. El campo afectado también se marca con borde de error. | Consistencia de paleta y error ubicado cerca del problema. | P2 |
| 📍4 | Agregar | Cuando el error es "email o contraseña incorrectos", sumar un link directo "recuperá tu contraseña" dentro del mensaje. | Ofrece la salida en el mismo momento del error (heurística 9). | P3 |
| 5 | Corregir | Unificar el ancho de las tarjetas de acceso a 400px (login y recuperar usan 400, onboarding 410). | Que las tres pantallas de acceso se sientan una sola familia. | P3 |
| 6 | Agregar | `autoFocus` en el campo email. | Se puede escribir apenas carga la página. | P3 |

**Copy**

| Antes | Después |
|---|---|
| ocurrió un error inesperado. | no pudimos iniciar sesión. probá de nuevo en unos segundos. |
| email o contraseña incorrectos. | email o contraseña incorrectos. revisalos o *recuperá tu contraseña*. |

---

## Etapa 2 · Recuperar contraseña — `/recuperar-password`

**Objetivo:** volver a entrar sin frustración. Previsualización: [`02-recuperar.png`](png/02-recuperar.png) muestra el paso 1 y el paso 2.

| # | Tipo | Qué | Por qué | Prio |
|---|---|---|---|---|
| 📍1 | Agregar | Barra de progreso de 2 segmentos, igual a la del onboarding, con el texto "paso 1 de 2" a la derecha. | El usuario sabe cuánto le falta. | P3 |
| 📍2 | Agregar | **Requisitos de contraseña en vivo** (8 caracteres, mayúscula, minúscula, número y símbolo) que se tildan mientras se escribe. | Hoy los requisitos de Cognito aparecen recién *después* de fallar. Prevenir es mejor que mostrar el error (heurística 5). | P1 |
| 📍3 | Agregar | "Reenviar código" como botón de texto visible, con cuenta regresiva ("reenviar código en 30 s"). | Hoy es un link chico y subrayado al final. La cuenta regresiva además evita el error `LimitExceededException`. | P2 |
| 📍4 | Simplificar | El campo "confirmar contraseña" usa el mismo toggle de visibilidad que el primero. | Consistencia: hoy uno tiene el ojito y el otro no. | P3 |
| 5 | Corregir | La flecha `←` de texto de "volver a iniciar sesión" pasa a ser el ícono `arrow_back`. | Íconos de una sola librería, sin glifos unicode. | P3 |
| 6 | Simplificar | El paso final ("¡contraseña actualizada!") usa el mismo círculo con check que el paso final del onboarding. | Mismo momento, mismo lenguaje visual. | P3 |

---

## Etapa 3 · Onboarding — `/onboarding`

**Objetivo:** crear la cuenta y configurar el negocio en menos de un minuto. Previsualización: [`03-onboarding.png`](png/03-onboarding.png) muestra los pasos 1, 2 y 3.

| # | Tipo | Qué | Por qué | Prio |
|---|---|---|---|---|
| 📍1 | Agregar | Texto "paso 1 de 4" a la derecha de la barra de progreso, en la misma línea. | La barra sola no dice cuántos pasos son ni en cuál estás. No va como etiqueta arriba del título, para no sumar ruido. | P2 |
| 📍2 | Simplificar | **Sucursales**: control `− 1 +` en vez del input numérico con el ícono de tienda. En la captura actual, ese ícono se lee como un calendario. | Un número chico (1–10) se elige mejor con un *stepper* y no se puede escribir un valor inválido. | P2 |
| 📍3 | Simplificar | El aviso "ajustaremos los algoritmos de costos e inflación…" pasa a ser texto de ayuda breve, sin caja ni sparkles: "usamos los índices de inflación del sector para estimar tus costos." | No es contenido generado por IA (ver 0.6) y la caja tintada le daba peso de alerta a un texto de marketing. | P3 |
| 4 | Corregir | La descripción del tipo de establecimiento en minúscula, como el resto ("venta tradicional de panificados…"). | Consistencia del sentence case. | P3 |
| 📍5 | Agregar | Paso 2: **requisitos de contraseña en vivo** (mismo componente que la Etapa 2). | Hoy el usuario se entera de que necesita mayúscula, número y símbolo recién cuando falla el registro. | P1 |
| 📍6 | Agregar | Paso 2: botón de texto "volver" para regresar al paso 1 sin perder lo cargado. | Hoy no hay forma de corregir el nombre del negocio sin recargar la página (heurística 3). | P2 |
| 📍7 | Agregar | Paso 3 (verificar email): "reenviar código" con cuenta regresiva y "cambiar email". | Hoy solo dice "revisá tu carpeta de spam". Si el mail no llega, el usuario queda trabado (P1). | P1 |
| 8 | Simplificar | Títulos alineados a la izquierda en los 4 pasos. Hoy los pasos 1–2 están a la izquierda y los 3–4 centrados. | Un solo eje de lectura en todo el flujo. | P3 |

---

## Etapa 4 · Dashboard — `/dashboard`

**Objetivo:** en 5 segundos saber si hay algo urgente y qué hacer. Previsualización: [`04-dashboard.png`](png/04-dashboard.png).

| # | Tipo | Qué | Por qué | Prio |
|---|---|---|---|---|
| 📍1 | Corregir | Saludo con el **nombre real del negocio** (desde la cuenta o la configuración) y título con el `PageHeader` (20px/500). | Hoy "Panadería La Espiga" está hardcodeado y no coincide con Configuración. Además el título es más grande y pesado que en el resto de las pantallas. | P1 |
| 📍2 | Quitar | El sparkle de la línea de fecha y el texto fijo "actualizado hace 2 minutos". Si el dato existe, mostrar la hora real ("actualizado 20:42"). | El sparkle no marca contenido de IA y el "hace 2 minutos" es siempre el mismo (miente). | P2 |
| 3 | Quitar | El botón "subir factura" del encabezado. | Duplica el CTA del sidebar, que está siempre visible. | P2 |
| 📍4 | Simplificar | **KPIs de 4 a 3**: *margen promedio*, *producción prevista para mañana* y *facturas por revisar*. Se quita "alertas de precio" porque el banner ya lo comunica, y en mejor forma. "28 / 32" pasa a "3 por revisar" (el mismo número que en Compras), que es la información accionable, y la tarjeta lleva a Compras filtrado por "por revisar". | Hoy los 2 productos con alerta aparecen 3 veces (KPI, banner y panel). Se elige el lugar que explica el porqué. | P2 |
| 📍5 | Simplificar | **Banner de alerta**: borde de 1px (sin barra izquierda de 3px), texto más corto y CTA como botón secundario "revisar precios". | Es el elemento más importante del dashboard: tiene que ser claro, no largo. | P2 |
| 📍6 | Agregar | "Aplicar" en *precios sugeridos* abre un **popover de confirmación** con el precio actual → sugerido y el margen resultante, y botones "aplicar $970" / "cancelar". | Cambia el precio de venta: necesita confirmación (heurística 5). | P1 |
| 📍7 | Corregir | Badge "−14% rentabilidad" → "margen 32% · obj. 40%". "Al día" con estilo informativo, sin parecer botón. Los botones "aplicar" pasan a secundarios (el dashboard no necesita un primario propio). | "−14% rentabilidad" no deja claro si es la caída o el margen actual. Mostrar margen actual vs objetivo sí lo deja claro. | P2 |
| 📍8 | Simplificar | **Predicción de demanda compacta**: el gráfico baja de ~520px a ~180px de alto, con el valor sobre la barra del pico y la fecha en el eje. El insight va en una sola línea con marca IA: "el sábado se espera el pico de la semana: +35% sobre el promedio". Se quita el badge "modelo v2.4". | Hoy el gráfico ocupa una pantalla entera con etiquetas de 26px y empuja todo hacia abajo. En el dashboard alcanza con la tendencia; el detalle está en Demanda. | P1 |
| 📍9 | Simplificar | Títulos de sección en sentence case, 14px/500 con ícono, sin barra lateral. "ver todas →" pasa a "ver todas" con ícono chevron. | Ver 0.2 y 0.5. | P3 |
| 📍10 | Agregar | *Compras recientes*: fecha de cada factura, y el badge "revisar" lleva directo a esa factura. | Hoy no se sabe de cuándo es cada compra y el badge no es clickeable. | P3 |

**Copy**

| Antes | Después |
|---|---|
| 2 productos necesitan ajuste de precio urgente — la IA detectó que la rentabilidad de Medialunas Manteca y Pan Francés (kg) caerá por debajo del objetivo debido a aumentos recientes en insumos. | 2 productos quedan por debajo de tu margen objetivo: medialunas de manteca y pan francés (kg). Subieron sus insumos. |
| histórico 7 días · proyección IA próximos 7 días | últimos 7 días y próximos 7 días |

---

## Etapa 5 · Historial de compras — `/compras`

**Objetivo:** encontrar rápido las facturas que necesitan revisión. Previsualización: [`05-compras.png`](png/05-compras.png).

| # | Tipo | Qué | Por qué | Prio |
|---|---|---|---|---|
| 📍1 | Simplificar | **Una sola barra de filtros** dentro de la tarjeta de la tabla: buscador de proveedor, rango de fechas y estado como selector segmentado ("todas · por revisar · procesadas"). Se filtra al escribir (con *debounce*), sin botón "Buscar" sólido. | Hoy hay dos zonas de filtros (una tarjeta arriba y un `select` dentro de la tabla) y un botón primario extra (ver 0.3). | P1 |
| 📍2 | Resaltar | KPI "facturas por revisar" clickeable: aplica el filtro "por revisar". El KPI "sobreprecios detectados" lleva la marca IA. | El KPI pasa de dato a atajo de la tarea principal de esta pantalla. | P2 |
| 📍3 | Corregir | Fecha formateada (`10/11/2026`), acción "revisar" en lugar de "Auditar" (el badge dice "revisar") y "Ver desglose" pasa a "ver detalle". | La acción y el estado tienen que llamarse igual (heurística 4). | P2 |
| 📍4 | Simplificar | "Exportar CSV" como botón secundario con ícono, a la derecha de la barra de filtros, junto al contador "12 facturas". | Acción de poco uso que hoy compite con los filtros. | P3 |
| 📍5 | Corregir | Paginación real (o "cargar más") y quitar el texto fijo "Página 1 de 4 · Actualizado hace 4 min". | Hoy los botones de página no hacen nada y el texto es siempre el mismo. | P2 |
| 6 | Agregar | **Estados**: filas skeleton mientras carga (en vez de "Cargando datos desde la nube…"), error en lenguaje humano con botón "reintentar" (hoy muestra el error crudo de la API) y estado vacío con CTA "subir tu primera factura". | Visibilidad del estado del sistema (heurística 1) y recuperación de errores (heurística 9). | P1 |
| 7 | Quitar | El botón "Subir factura" del encabezado (está en el sidebar, ver 0.12). Solo reaparece en el estado vacío. | Menos duplicación. | P3 |

**Copy**

| Antes | Después |
|---|---|
| Facturas procesadas y auditadas por IA | Todas tus facturas. La IA marca las que conviene revisar. |
| No se pudieron cargar las compras: Error HTTP: 500 | No pudimos cargar tus compras. Revisá tu conexión y probá de nuevo. **[reintentar]** |
| No hay facturas que coincidan. | No hay facturas con esos filtros. **[limpiar filtros]** |

---

## Etapa 6 · Subir factura — `/compras/subir`

**Objetivo:** cargar una factura y confiar en lo que leyó la IA antes de guardarla. Previsualizaciones: [`06a-subir-vacio.png`](png/06a-subir-vacio.png) (antes de elegir archivo), [`06c-subir-leyendo.png`](png/06c-subir-leyendo.png) (mientras la IA lee la factura) y [`06b-subir-revision.png`](png/06b-subir-revision.png) (revisión).

> **Actualizado con los cambios de `main` del 13/11** (PR #103 y commit `119108a`). La pantalla ya no usa ítems de ejemplo: sube el archivo, espera a que la IA lo lea (consultando `/compras` cada 3 s, hasta 60 s) y muestra los ítems reales. El botón principal ahora es "Subir y extraer datos" y pasa a "Confirmar y guardar" recién cuando hay datos.

| # | Tipo | Qué | Por qué | Prio |
|---|---|---|---|---|
| 📍1 | Agregar | **Indicador de pasos** "1 subir · 2 revisar · 3 confirmar". El componente `StepIndicator.tsx` ya existe y no se usa. Con el flujo nuevo, los tres momentos existen de verdad. | Orienta en un flujo de varios pasos (§5.4 del `DESIGN.md`). | P2 |
| 📍2 | Corregir | ✅ *Resuelto en parte por el compañero:* sin archivo, el botón principal ("Subir y extraer datos") queda deshabilitado en vez de parecer activo. **Falta:** usar el estilo de deshabilitado del sistema (0.3) en lugar de bajar la opacidad, y `cursor: not-allowed` (hoy sigue en `pointer`). | Un botón deshabilitado tiene que verse y comportarse como tal. | P3 |
| 📍3 | Agregar | En el estado vacío, tres líneas breves de qué va a pasar: "leemos proveedor, ítems y totales · vas a poder corregir todo · confirmás al final". **Ojo:** no prometer "no se guarda nada hasta que confirmes": con el flujo nuevo, la factura queda registrada apenas la IA la lee. | Baja la ansiedad de subir un documento con plata. El texto tiene que decir lo que realmente pasa. | P2 |
| 📍4 | Corregir | ✅ *Resuelto en parte:* ya existe un estado de "procesando". **Falta:** cambiar el texto "Procesando factura en la cola SQS con Gemini Vision…" por "Leyendo tu factura… suele tardar unos segundos", sumar un skeleton de la tabla y una barra de progreso indeterminada. | Jerga técnica (0.7). El skeleton anticipa qué va a aparecer. | P1 |
| 📍5 | Corregir | **No inventar confianza.** Hoy todos los ítems que lee la IA se muestran con confianza "alta" fija (el OCR no la informa) y el banner también dice "confianza alta" fijo. Mientras el backend no mande la confianza por ítem, no mostrarla. Cuando la mande, resaltar los ítems con confianza baja en el banner ("1 ítem con confianza baja: revisalo") y en la fila, como en el mockup. | Principio 4 del `DESIGN.md`: decir "alta" sin saberlo hace que el usuario no revise justo lo que debería. | P1 |
| 📍6 | Simplificar | **Mostrar todos los ítems**, sin colapsar a 3 (`InvoiceTable` no cambió). | Con facturas reales, la fila que hay que revisar puede quedar oculta. | P1 |
| 📍7 | Simplificar | **Proveedor detectado integrado** en la tarjeta del archivo, en una sola fila: archivo · proveedor · CUIT. El badge "IA OCR" pasa a ser el badge "IA" del sistema (0.6). | Dos tarjetas para datos del mismo documento es carga visual innecesaria. "OCR" es jerga técnica. | P2 |
| 📍8 | Corregir | Badges de confianza sin `✓` ni `⚠`, y el encabezado de columna "Estado AI" pasa a "confianza". | Ver 0.4. Además "Estado AI" mezcla inglés y no dice qué mide. | P3 |
| 📍9 | Simplificar | Resumen de totales en bloque a la derecha, como en una factura real: subtotal, IVA, percepciones y total. | El ojo busca el total abajo a la derecha. | P3 |
| 10 | Agregar | **Popup** al salir de la revisión con correcciones sin confirmar: "¿Salir sin confirmar? La factura ya quedó registrada con lo que leyó la IA; se pierden tus correcciones." | Evita perder la revisión por un clic accidental, sin prometer algo que no pasa. | P2 |
| 11 | Corregir | **"Confirmar y guardar" no guarda las correcciones**: hoy solo vuelve a Compras y lo editado en la tabla se pierde. Hace falta que mande los ítems corregidos al backend. Mientras tanto, el botón debería llamarse "volver a compras" o la tabla no debería ser editable. | El botón promete algo que no hace (heurística 1). Es el problema más grave de la pantalla. | P1 |

**Copy**

| Antes | Después |
|---|---|
| Procesando factura en la cola SQS con Gemini Vision… (esto puede demorar unos segundos) | Leyendo tu factura… suele tardar unos segundos. |
| El análisis por IA demoró más de 60 segundos. Podés verificar la factura más tarde en el historial de compras. | La lectura está tardando más de lo normal. Te avisamos en Compras cuando esté lista. **[ir a compras]** |
| Distribuidora detectada · IA OCR | *(una sola fila)* Distribuidora Sur S.A. · CUIT 30-71449821-4 · **IA** |

---

## Etapa 7 · Precios sugeridos — `/precios`

**Objetivo:** decidir rápido qué precios ajustar, sin ruido de los que ya están bien. Previsualizaciones: [`07-precios.png`](png/07-precios.png) y [`07b-precios-confirmar.png`](png/07b-precios-confirmar.png) (popup de confirmación).

> Es la etapa con más impacto. Hoy hay 7 tarjetas grandes, cada una con 9 piezas (unidad, 2 badges, nombre, ID, grilla de 3 precios, margen, análisis, estado y botón), y 8 botones sólidos. Cuando todos los precios están estables, la pantalla tiene muchísimo para leer y nada para hacer.

| # | Tipo | Qué | Por qué | Prio |
|---|---|---|---|---|
| 📍1 | Corregir | Título "Precios sugeridos" con badge "IA", en lugar de "Sugerencias de Precios con IA" y el badge "Gemini". | Sentence case (0.2), sin nombre de proveedor técnico (0.7). | P2 |
| 📍2 | Quitar | El banner verde "Generación completada: Sugerencias generadas correctamente" y el "ID: sug-4e19a695…". Se reemplazan por una línea discreta junto al botón: "actualizado 13/11, 20:45". | El banner celebra algo que el usuario no pidió confirmar y el ID no le sirve. Ocupa el lugar más visible de la pantalla. | P1 |
| 📍3 | Simplificar | **KPIs de 4 a 3**: *requieren revisión*, *margen promedio (con el objetivo por categoría)* y *aumento promedio sugerido*. "Sin costo calculable" se muestra solo si es mayor que 0, como aviso dentro de la tabla. | Una tarjeta que dice "0 · No pudieron recibir una sugerencia" es ruido. Comparar contra el objetivo le da sentido al margen. | P2 |
| 📍4 | Simplificar | **Tabla en lugar de tarjetas** (como define el §5.6): producto · costo · actual · sugerido · variación · margen · acción. Los que requieren revisión van arriba con fondo suave, y los estables abajo con "al día" informativo. | Se comparan 7 productos de un vistazo, en una pantalla en vez de tres. *Alternativa más conservadora:* mantener tarjetas, pero compactas (sin ID, sin unidad arriba y con el análisis colapsado) y con botón solo en las que requieren revisión. | P1 |
| 📍5 | Simplificar | El **análisis de la IA** se despliega por fila (chevron "por qué"), en vez de un bloque fijo en cada tarjeta. | La explicación importa cuando hay que decidir, no para los precios que ya están bien. | P2 |
| 6 | Quitar | "ID: te-con-leche" y la etiqueta de unidad en mayúsculas ("VASO"). La unidad va junto al nombre: "té con leche · por vaso". | El ID es interno. La unidad es contexto del nombre, no una etiqueta aparte. | P2 |
| 📍7 | Agregar | **Popup de confirmación** al aplicar un precio: producto, $actual → $sugerido, margen resultante vs objetivo y el aviso "el nuevo precio se usa desde ahora en tus reportes". Al confirmar aparece un toast con "deshacer". | Es una decisión con plata e irreversible desde la interfaz (heurística 5). | P1 |
| 📍8 | Agregar | Acción masiva "aplicar los 2 sugeridos" en el encabezado del grupo "requieren revisión" (también con confirmación). | Cuando suben los insumos, es común ajustar varios a la vez (heurística 7). | P3 |
| 9 | Corregir | En productos sin costo, cambiar "verificá que tengan su registro en las tablas Producto y Receta-nueva" por "cargá la receta de este producto para que podamos calcular su costo". | Jerga de base de datos (0.7). | P2 |
| 10 | Quitar | El pie "N productos analizados · N sugerencias generadas · Estado: completed". | Información técnica sin valor para el usuario. | P3 |
| 📍11 | Agregar | Estado positivo cuando no hay nada para revisar: "Todos tus precios cubren el margen objetivo." con check, arriba de la tabla. | Hoy, con 0 en revisión, la pantalla no lo dice: hay que deducirlo de los badges. | P2 |

**Copy**

| Antes | Después |
|---|---|
| Análisis de Gemini | Por qué este precio |
| Pendiente de aprobación (en productos estables) | *(se quita: no hay nada que aprobar)* |
| Aplicar precio (en productos con sugerido = actual) | al día *(informativo)* |
| Analizando productos con Gemini... | Calculando precios sugeridos… |

---

## Etapa 8 · Predicción de demanda — `/demanda`

**Objetivo:** saber cuánto producir cada día y anticipar los picos. Previsualización: [`08-demanda.png`](png/08-demanda.png).

> **Actualizado con los cambios de `main` del 13/11** (PR #104, #106 y #108). La pantalla ahora lee datos reales de `GET /demanda` (se fueron los mocks), el gráfico muestra solo la predicción (se quitaron el histórico y el marcador "hoy"), el botón pasó de "Recalcular con IA" a "Actualizar" y se sumó una tarjeta con el **pronóstico del clima** de 7 días.

| # | Tipo | Qué | Por qué | Prio |
|---|---|---|---|---|
| 📍1 | Quitar | El banner "Datos con IA. La sugerencia la generó el modelo a partir del contexto enviado a la Lambda.". Ahora aparece **dos veces**: también sobre el pronóstico del clima, porque `EstadoApi` lo envuelve, y el clima no lo calcula la IA. La marca IA pasa al título de la tabla. El aviso de modo "reglas" se mantiene, pero en lenguaje humano. | Jerga técnica (0.7) y una afirmación falsa sobre el clima. El estado normal no necesita un banner, solo el caso excepcional. | P1 |
| 📍2 | Agregar | **Banner de recomendación del pico** (§5.7): "El sábado se espera el pico de la semana: +35% sobre el promedio. Conviene reforzar medialunas de manteca y pan francés." | Es la acción más valiosa de la pantalla y todavía no está. | P2 |
| 📍3 | Resaltar | ✅ *En parte:* sacar el histórico simplificó el gráfico y el marcador "hoy" ya no hace falta. **Falta:** **valores** sobre las barras y la fecha en el eje ("sá 14" en vez de solo "sáb", que se repite si hay más de una semana). | Sin valores ni eje Y, el gráfico solo dice "más alto" o "más bajo". | P2 |
| 4 | Corregir | ✅ *Resuelto por el compañero:* "producción total prevista para los próximos 7 días" ahora suma los 7 días que devuelve la API, así que el dato coincide con su etiqueta. | — | — |
| 📍5 | Corregir | **La tabla mezcla días.** Ahora lista los productos de los 7 días juntos sin mostrar la fecha, así que el mismo producto puede aparecer hasta 7 veces sin saber de qué día es cada fila. Sumar un **selector de día** (por defecto, mañana) y titular la tarjeta "Producción sugerida · sábado 14/11", con columnas "producto · cantidad · confianza" y orden por cantidad. | Sin la fecha, la tabla no sirve para planificar la producción. | P1 |
| 6 | Corregir | ✅ *En parte:* la confianza ya no es aleatoria. **Falta:** cuando la API no la manda, hoy se muestra "media" por defecto. Mostrar "sin dato" en ese caso. | Principio 4 del `DESIGN.md` (honestidad en la incertidumbre). | P2 |
| 📍7 | Agregar | Botón secundario "imprimir lista" para el obrador (imprime el día elegido en el selector). | En una panadería real, la lista de producción se lleva impresa al horno. | P3 |
| 📍8 | Corregir | ✅ *En parte:* la precisión ya viene del backend (`precision`). **Falta:** cambiar el subtítulo "backtest de los últimos 7 días" por algo simple: "comparada con lo que se vendió los últimos 7 días". | "Backtest" es jerga técnica. | P3 |
| 📍9 | Simplificar | **Clima integrado al gráfico.** En lugar de una tarjeta aparte con 7 cajitas, mostrar debajo de cada barra el ícono del clima, la máxima y el % de lluvia. Así se lee directo por qué un día baja la producción (p. ej., domingo con lluvia: 130 u.). Si el pronóstico no está disponible, la fila de clima desaparece y el gráfico sigue igual. | Una tarjeta menos, y el clima queda al lado del dato al que afecta, en vez de obligar a cruzar dos bloques. | P2 |
| 10 | Corregir | Los días de lluvia se pintan con el fondo de **advertencia** (rojizo). La lluvia es información, no un riesgo: usar el ícono de lluvia y el texto en `text-secondary`, y reservar el rojizo para "riesgo de faltante". | El color de advertencia tiene que significar una sola cosa. | P3 |

**Copy**

| Antes | Después |
|---|---|
| No hay predicciones generadas para este usuario. (Espera a que el cronjob corra). | Todavía no hay una predicción. Se genera automáticamente todas las noches. |
| No se pudo cargar la predicción de demanda desde la base de datos. | No pudimos cargar la predicción. Probá de nuevo en unos segundos. **[reintentar]** |
| Con lluvia (≥ 60 % o ≥ 2 mm) el modelo reduce la producción prevista | Los días con lluvia, la producción prevista baja. |
| Precisión del modelo · backtest de los últimos 7 días | Precisión de la predicción · comparada con lo vendido los últimos 7 días |
| Recomendación de producción *(encabezado de columna)* | Producción sugerida · sábado 14/11 *(título de la tarjeta)* |

---

## Etapa 9 · Configuración — `/configuracion`

**Objetivo:** ajustar datos y preferencias sin miedo a perder cambios. Previsualización: [`09-configuracion.png`](png/09-configuracion.png).

| # | Tipo | Qué | Por qué | Prio |
|---|---|---|---|---|
| 📍1 | Quitar | El link "← Volver al dashboard", y marcar "Configuración" como activa en el sidebar. | La navegación ya está en el sidebar. Hoy además el sidebar no indica dónde estás. | P2 |
| 📍2 | Corregir | Inputs de texto alineados a la izquierda (hoy "Panadería Central" está alineado a la derecha) y números a la derecha con el `%` dentro del campo. | Convención estándar: el texto se lee desde la izquierda. | P3 |
| 📍3 | Agregar | "Tipo de negocio" con la ayuda "se define al crear la cuenta", y una fila de solo lectura "moneda: $ ARS · peso argentino" (§5.8) dentro de *Datos del negocio*, sin una tarjeta aparte. | Explica por qué no se puede editar y cumple el `DESIGN.md` sin sumar otra tarjeta. | P3 |
| 📍4 | Agregar | Ayuda bajo *Márgenes objetivo*: "la IA usa estos márgenes para sugerir tus precios". | Conecta esta configuración con la pantalla de Precios. Hoy no se entiende para qué sirve. | P2 |
| 📍5 | Agregar | **Barra de guardado fija** que aparece solo cuando hay cambios: "tenés cambios sin guardar · descartar · guardar cambios". Se quita el botón suelto al final. | Con 4 tarjetas, el botón al final queda fuera de la vista. La barra además avisa que hay algo pendiente. | P1 |
| 6 | Corregir | Confirmación con toast "Cambios guardados" en lugar de "¡Configuración guardada exitosamente en DynamoDB!". | Jerga técnica (0.7). | P1 |
| 7 | Agregar | **Popup** al salir con cambios sin guardar: "¿salir sin guardar? Vas a perder los cambios." | Previene la pérdida de datos. | P2 |
| 📍8 | Agregar | En *Notificaciones*, indicar el canal: "te avisamos por email a rodrigo@…". Los toggles con `role="switch"` y `aria-checked`. | El usuario no sabe dónde van a llegar los avisos. Además los toggles no son accesibles para lectores de pantalla. | P3 |
| 9 | Agregar | "Invitar miembro" abre un **popup** con email y rol. | Hoy el botón no hace nada. | P3 |

---

## Orden de implementación sugerido

| Orden | Etapa | Esfuerzo | Por qué en este orden |
|---|---|---|---|
| 1 | **0 · Fundamentos** | Medio | Resuelve de una vez las inconsistencias de todas las pantallas y crea los componentes que usan las demás etapas. |
| 2 | **7 · Precios** | Alto | La pantalla con más ruido y la única con acciones de plata sin confirmación. |
| 3 | **4 · Dashboard** | Medio | Es la primera pantalla después del login. |
| 4 | **6 · Subir factura** | Medio | Flujo principal de carga de datos. "Confirmar y guardar" no guarda las correcciones, y el estado de carga muestra jerga técnica. |
| 5 | **5 · Compras** | Medio | Unificar filtros y estados. |
| 6 | **8 · Demanda** | Medio | Separar la tabla por día, sacar el banner de IA (también del clima) e integrar el clima al gráfico. |
| 7 | **9 · Configuración** | Bajo | Barra de guardado y copy. |
| 8 | **3 · Onboarding** | Bajo | Requisitos de contraseña y reenviar código. |
| 9 | **1–2 · Login y recuperar** | Bajo | Pulido. |

## Inconsistencias de datos a resolver (frontend + backend)

Estas no son de diseño, pero hacen que la interfaz parezca poco confiable:

1. **Nombre del negocio**: el Dashboard dice "Panadería La Espiga" (hardcodeado) y Configuración "Panadería Central" (valor inicial hardcodeado). Debe salir de la cuenta.
2. **Alertas de precio**: el Dashboard usa un mock con 2 alertas y Precios trae 0 de la API. El Dashboard debería leer el mismo endpoint.
3. **Producción prevista**: el Dashboard sigue mostrando 2.180 u. (mock), mientras que Demanda ya muestra el total real de 7 días que devuelve `GET /demanda`. El Dashboard debería leer ese mismo endpoint.
4. **Facturas por revisar**: "4 pendientes de revisión" (Dashboard) vs "3" (KPI de Compras).
5. **Margen objetivo**: Configuración define panadería 40%, pastelería 45% y bebidas 60%, pero el análisis de IA de Precios habla de "margen objetivo del 60%" para productos de panadería. Revisar qué margen recibe la Lambda.
6. **`usuarioID: "user_test_123"` fijo**: lo usan Configuración al guardar y, desde los cambios del 13/11, también las consultas de Demanda y Clima. Deben usar el usuario autenticado.
7. **"Actualizado hace N minutos"** sigue siendo un valor fijo (Dashboard y Compras). La precisión del modelo ya viene del backend.
8. **Nombres de productos**: "Media luna de jyq" (abreviatura del dato cargado) aparece así en Precios. En los mockups se muestra como "Medialuna de jamón y queso".
9. **Subir factura**: la confianza de cada ítem se muestra siempre "alta" porque el OCR no la informa, y "Confirmar y guardar" no envía las correcciones al backend (ver Etapa 6, ítems 5 y 11).

> Los mockups usan un único set de datos ficticios coherente entre pantallas (315 u. para mañana, 3 facturas por revisar, 2 precios a revisar, objetivo de panadería 40%), justamente para mostrar cómo se ve la interfaz cuando los números coinciden.

## Verificación automática

Se corrió el detector de `impeccable` sobre los mockups. Resultados:

- **Contraste** (66 avisos en la primera pasada): eran las combinaciones de los ítems 0.8 y 0.15 (acento con blanco, `text-muted` y badge neutro). Ya están aplicadas en los mockups.
- **Paleta crema** (11 avisos): es intencional. Es la identidad de la marca y el pedido fue conservarla.
- **Padding ajustado en badges y en el stepper** y **texto de 11px**: son decisiones del sistema de diseño (§3.2 y §4 del `DESIGN.md`), no errores.
- **Salto de encabezado** (h1 → h3 en el popup de Precios): al implementarlo, el título del popup tiene que ser un `h2`.

## Fuera de alcance

- Versión mobile y responsive (el producto es solo de escritorio por ahora).
- Modo oscuro.
- Cambios de paleta, tipografía o logo.
- Nuevas funcionalidades de backend (solo se marcan las inconsistencias de datos).
