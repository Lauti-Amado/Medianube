# DESIGN.md — medianube

Especificación de diseño para la implementación del wireframe de **medianube**, el SaaS que usa inteligencia artificial para automatizar el día a día de una panadería: gestiona las compras analizando facturas directamente, sugiere precios de venta para proteger la rentabilidad frente a la inflación, y predice la demanda futura de producción.

Este documento traduce a especificación escrita lo definido en wireframes y en el prototipo interactivo clickeable. Es la referencia para implementar la interfaz — no un mockup de alta fidelidad, sino la base de estructura, contenido y estilo sobre la que se construye.

---

## 1. Alcance de esta versión

- **Plataforma:** web de escritorio únicamente. El flujo de "subir factura" está pensado para cargar un archivo desde la computadora, no para sacar una foto desde el celular (queda como posible extensión futura).
- **Moneda:** pesos argentinos (ARS) únicamente. No hay selector de moneda ni soporte para cobro en otras monedas en esta versión.
- **Usuarios:** dueños/encargados de panadería y su equipo (producción, administración). No hay rol de cliente final ni e-commerce.
- **Pantallas incluidas:** Login, Onboarding, Dashboard, Subir factura, Compras, Precios, Predicción de demanda, Configuración (8 en total).

---

## 2. Principios de diseño

1. **Cálido pero preciso.** La marca es una panadería (crema, caramelo, marrón), pero el producto maneja plata y datos: cada número, precio y porcentaje tiene que leerse con claridad. La calidez vive en el color y el tono de copy, no en decoración que compita con los datos.
2. **La IA se muestra, no se esconde.** Cada vez que un valor viene de un modelo (precio sugerido, predicción de demanda, datos extraídos de una factura), la interfaz lo marca explícitamente (ícono de sparkles, badge "IA", nivel de confianza) en vez de presentarlo como un dato más.
3. **El estado siempre es color + texto.** Ningún estado (procesada / revisar, alta / media / baja confianza, variación de precio) se comunica solo con color. Siempre hay una palabra al lado.
4. **Honestidad en la incertidumbre.** Cuando el modelo tiene poca data (producto nuevo, pocas facturas históricas), la interfaz lo dice ("baja confianza", "pocos datos") en vez de mostrar un número con la misma autoridad que uno bien respaldado.
5. **Una acción primaria por pantalla.** Cada pantalla tiene un solo botón de acento sólido (el CTA principal). Todo lo demás usa contorno, texto o color neutro.

---

## 3. Sistema de diseño (tokens)

### 3.1 Color

| Token | Hex | Uso |
|---|---|---|
| `bg` | `#FBF1E7` | Fondo de página / pantalla completa |
| `surface` | `#FFFFFF` | Tarjetas, tablas, modales |
| `surface-input` | `#FFFDFB` | Fondo de inputs (ligeramente distinto de `surface` para diferenciarlos dentro de una tarjeta blanca) |
| `border` | `#E8D9C7` | Bordes de tarjetas, inputs, divisores de filas |
| `border-strong` | `#C9986B` | Borde del isotipo / elementos que necesitan más contraste que `border` |
| `accent` | `#B5722E` | Botones primarios, tab activo, marca, elementos interactivos clave |
| `accent-dark` | `#8A5423` | Texto sobre fondos tintados de acento, estado hover de `accent` |
| `text-primary` | `#4A3222` | Títulos, texto de mayor jerarquía, valores numéricos importantes |
| `text-secondary` | `#8C7361` | Subtítulos, ayudas, metadatos, labels de tabla |
| `text-muted` | `#B08D6F` | Texto terciario: placeholders de navegación, "cerrar sesión", timestamps |
| `tint-accent` | `#F6E4D3` | Fondo de banners de IA, del isotipo, de badges "predeterminada" |
| `success-bg` / `success-text` | `#E3EFD9` / `#4B6B2E` | Estados positivos: "procesada", "alta confianza" |
| `warning-bg` / `warning-text` | `#F7E3DD` / `#A34A2D` | Estados que requieren atención: "revisar", "baja confianza", subas de precio |
| `neutral-bg` / `neutral-text` | `#F0E4D4` / `#8C7361` | Estados neutros: "estable", "al día", "media confianza" |

No usar sombras (`box-shadow`) en ningún componente: la jerarquía se construye con color de fondo y borde de 1px, no con elevación.

### 3.2 Tipografía

- **Una sola familia sans-serif** para toda la interfaz (recomendado: Inter, Work Sans o similar — geométrica pero cálida, con buena lectura en tamaños chicos de tabla).
- **Dos pesos únicamente:** regular (400) para texto de cuerpo y valores de tabla; medio (500) para títulos, botones y énfasis. No usar bold (700) salvo casos puntuales de KPI muy grandes.
- **Sentence case en toda la interfaz**, incluyendo botones, tabs y labels ("iniciar sesión", no "Iniciar Sesión" ni "INICIAR SESIÓN"). Es parte del tono cálido y conversacional de la marca.
- **Escala tipográfica:**

| Uso | Tamaño | Peso |
|---|---|---|
| Título de pantalla | 18px | 500 |
| Título de tarjeta / sección | 13–14px | 500 |
| Cuerpo / valores de tabla | 12–13px | 400 |
| Labels, metadatos, timestamps | 11px | 400 |
| KPI destacado | 20–24px | 500 |

### 3.3 Espaciado y geometría

- Grilla base de **4px** (usar múltiplos: 4, 8, 12, 16, 24, 32).
- Radios de borde: **8px** en inputs, botones y badges; **10–12px** en tarjetas de contenido; **16px** en contenedores grandes (tarjeta de login/onboarding, frame general de la app).
- Bordes de **1px sólido** en `border`, siempre visibles (no depender solo de espacio en blanco para separar tarjetas).
- Ancho de contenido máximo recomendado: layout de dashboard a ancho completo con márgenes de 24px; tarjetas de login/onboarding centradas, ancho fijo ~280–340px.

### 3.4 Iconografía

- Set de íconos **outline** (línea fina, sin relleno) en toda la interfaz — se usó el set Tabler Icons como referencia durante el wireframe.
- Tamaños: 14px en línea con texto pequeño, 16–18px en botones e íconos de acción, 20–22px en elementos destacados (isotipo, ícono de archivo subido).
- Ícono de sparkles (✨) reservado exclusivamente para marcar contenido generado por IA — no usarlo decorativamente en ningún otro contexto, para que mantenga su significado.

---

## 4. Componentes

| Componente | Descripción |
|---|---|
| **Barra de navegación superior** | Isotipo circular + wordmark "medianube" a la izquierda, tabs de navegación (dashboard / compras / precios / demanda) al lado. A la derecha: ícono de configuración (engranaje), texto "cerrar sesión" y avatar circular con iniciales. El tab activo se muestra con fondo `accent` sólido y texto blanco; los inactivos en `text-secondary` sin fondo. |
| **Tarjeta KPI** | Fondo `surface`, borde `border`, radio 10px, padding 12–14px. Label en `text-secondary` (11px) arriba, valor grande en `text-primary` (20px, 500) debajo. El color del valor puede cambiar a `warning-text` cuando el KPI representa un riesgo (ej. "alertas de precio"). |
| **Fila de lista / tabla** | Sin bordes de celda tradicionales: cada fila es un `flex` con divisor superior de 1px en un tono de borde más claro (`#F5EBDF`). Fila de encabezado en `text-secondary` 11px. Los valores numéricos se alinean a la derecha. |
| **Badge de estado** | Pill con padding 2–3px × 8px, radio 6px, combinación de `*-bg` / `*-text` según el estado (éxito / alerta / neutro). Siempre incluye texto, nunca es solo un punto de color. |
| **Banner de IA** | Tarjeta con fondo `tint-accent`, radio 10px, ícono de sparkles o bulb en `accent-dark`, texto en `#6B4226`. Se usa para resúmenes generados por IA (extracción de factura) y recomendaciones accionables (pico de demanda). |
| **Botón primario** | Fondo `accent` sólido, texto blanco 500, radio 8px, sin borde. Uno solo por pantalla. |
| **Botón secundario** | Fondo `surface`, borde 1px `border`, texto `text-primary`. Para acciones alternativas ("cancelar", "ingresar con Google"). |
| **Input de texto** | Fondo `surface-input`, borde 1px `border`, radio 8px, padding 10px 12px, texto 13px. Label arriba en `text-secondary` 12px. |
| **Chip / selector segmentado** | Usado en onboarding para elegir tipo de negocio. Seleccionado: fondo `accent`, texto blanco. No seleccionado: fondo `surface`, borde `border`, texto `text-primary`. Radio completo (pill, 20px). |
| **Toggle** | Pill de 34×20px. Activo: fondo `accent` con círculo blanco a la derecha. Inactivo: fondo `border` con círculo blanco a la izquierda. |
| **Indicador de pasos** | Dos variantes: (a) barra de progreso segmentada (onboarding, 3 segmentos, activo en `accent`); (b) breadcrumb de texto "1. subir → 2. revisar → 3. confirmar" (subir factura), paso activo en `accent` y 500. |
| **Gráfico de barras histórico vs. predicción** | Barras en `border` (`#E8D9C7`) para días históricos, barras en un tono intermedio de acento (`#C9986B`) para días predichos, separadas por un divisor vertical punteado marcado "hoy". Siempre acompañado de una leyenda de dos ítems. |
| **Isotipo / marca** | Círculo de 28–44px según contexto, fondo `tint-accent`, borde `border-strong`, ícono de pan/bakery centrado en `#9C6B3E`. El wordmark "medianube" siempre en minúsculas, peso 500. |

---

## 5. Pantallas

### 5.1 Login — `/login`

**Objetivo:** acceso simple y confiable al panel, reforzando la marca desde el primer contacto.

**Layout:** pantalla completa con fondo `bg`, tarjeta centrada (280px, `surface`, radio 16px) con: isotipo + wordmark centrados → título "iniciar sesión" → subtítulo "accedé al panel de tu panadería" → input de email → input de contraseña → link "¿olvidaste tu contraseña?" alineado a la derecha → botón primario "iniciar sesión" → divisor "o" → botón secundario "ingresar con Google" → texto de pie "¿no tenés cuenta? *solicitar demo*" (el link lleva a onboarding).

**Estados:** sin variantes de error definidas en el wireframe — a definir en implementación (email/contraseña inválidos, cuenta no encontrada).

---

### 5.2 Onboarding — `/onboarding` (paso 1 de 3)

**Objetivo:** configurar los datos básicos del negocio apenas se crea la cuenta.

**Layout:** misma estructura de tarjeta centrada que login, pero 320px de ancho. Contiene: barra de progreso de 3 segmentos (paso 1 activo) → label "paso 1 de 3" → título "contanos sobre tu panadería" → subtítulo "esto ayuda a personalizar tus precios y predicciones" → input "nombre del negocio" → selector de chips "tipo de negocio" (panadería / pastelería / cafetería / mixto) → campos "sucursales" y "moneda" en dos columnas → botón primario "continuar" → link "omitir por ahora".

**Nota de alcance:** el campo "moneda" de este paso queda fijo en ARS (ver §6 Configuración) — no mostrar selector editable.

**Pasos 2 y 3 (fuera del wireframe actual, a definir):** sugeridos como "productos iniciales / catálogo" y "confirmación con resumen". Ambos deben poder omitirse sin bloquear el acceso al dashboard.

---

### 5.3 Dashboard — `/dashboard`

**Objetivo:** vista general del negocio en un vistazo: rentabilidad, compras recientes, precios sugeridos y demanda prevista.

**Layout:** barra de navegación superior (tab "dashboard" activo) → fila de 3–4 tarjetas KPI (margen promedio, alertas de precio, producción prevista, facturas procesadas) → grilla de 2 columnas con paneles resumen de "compras recientes" y "precios sugeridos" (cada uno con link "ver todas/os" a su pantalla completa) → panel de ancho completo con resumen de "predicción de demanda" y link "ver detalle".

**Contenido de ejemplo:** todos los ejemplos de esta pantalla deben ser de productos de panadería (medialunas, pan francés, café con leche, etc.), consistentes con el resto de las pantallas — no usar ejemplos de restaurante genérico (milanesas, pizza).

---

### 5.4 Subir factura — `/compras/subir`

**Objetivo:** que cargar una factura sea tan simple como arrastrarla, dejando que la IA extraiga los datos y la persona solo confirme.

**Layout:** link "← volver a compras" → indicador de pasos "1. subir → 2. revisar → 3. confirmar" (paso 2 activo) → título "subir factura" → tarjeta de archivo cargado (nombre, peso, opción de quitar) → banner de IA con resumen ("la IA detectó X productos por un total de $Y. Revisá antes de confirmar.") → tabla editable de ítems (producto, cantidad, precio unitario, subtotal — cada fila con ícono de lápiz para editar) → botones "cancelar" y "confirmar y guardar".

**Comportamiento clave:** el paso "revisar" es el más importante del flujo — toda fila debe ser editable, porque la extracción por IA puede tener errores. Confirmar la factura vuelve a la pantalla de compras con la nueva factura reflejada en el historial.

**Alcance confirmado:** flujo pensado únicamente para escritorio (arrastrar archivo o seleccionar desde el explorador). No incluye captura por cámara de celular en esta versión.

---

### 5.5 Compras — `/compras`

**Objetivo:** ver y auditar todas las facturas procesadas, detectando rápido cuáles necesitan revisión manual.

**Layout:** barra de navegación (tab "compras" activo) → título "historial de compras" + botón primario "subir factura" → 3 tarjetas KPI (total de compras del mes, facturas por revisar, sobreprecios detectados por IA) → buscador + filtro de fecha + filtro de estado → tabla: proveedor, fecha, ítems, total, estado, acceso al detalle.

**Estados de factura:** `procesada` (éxito), `revisar` (alerta), `procesando` (neutro, mientras la IA todavía está extrayendo datos).

---

### 5.6 Precios — `/precios`

**Objetivo:** mostrar todos los precios sugeridos por la IA frente a los actuales, para decidir en qué productos ajustar.

**Layout:** barra de navegación (tab "precios" activo) → título "precios sugeridos" + botón primario "recalcular con IA" → 3 tarjetas KPI (margen promedio, productos bajo margen objetivo, ahorro potencial estimado) → buscador + filtro de categoría → tabla: producto, categoría, costo, precio actual, precio sugerido, variación, acción.

**Comportamiento clave:** los productos ya alineados no deben generar ruido visual — su badge de variación usa el tono neutro ("estable") y la acción de la fila pasa a ser informativa ("al día") en vez de accionable ("aplicar").

---

### 5.7 Predicción de demanda — `/demanda`

**Objetivo:** anticipar cuánto producir en los próximos días para evitar tanto el faltante como el sobrante.

**Layout:** barra de navegación (tab "demanda" activo) → título "predicción de demanda" → filtro de categoría + botón primario "recalcular con IA" → 3 tarjetas KPI (producción total prevista, precisión del modelo, productos en riesgo de faltante) → gráfico de 14 barras (7 días históricos + 7 predichos, separados por marcador "hoy") con leyenda → banner de recomendación accionable sobre el pico previsto → lista "recomendación de producción para mañana" con nivel de confianza por producto.

**Comportamiento clave:** la confianza del modelo se muestra siempre junto a la recomendación. Un producto nuevo con poco historial debe mostrar "baja confianza" explícitamente, nunca ocultarlo detrás de un número con la misma autoridad que uno bien respaldado.

---

### 5.8 Configuración — `/configuracion`

**Objetivo:** administrar los datos del negocio, moneda, márgenes objetivo, equipo y notificaciones.

**Layout:** link "← volver al dashboard" (no forma parte de la navegación principal por tabs, es un área separada) → título "configuración" → 5 tarjetas apiladas:

1. **Datos del negocio** — nombre del negocio (editable), tipo de negocio (de solo lectura en esta versión, definido en el onboarding), cantidad de sucursales (editable).
2. **Moneda** — fila fija mostrando "$ ARS — peso argentino" con badge "predeterminada" y nota "por ahora medianube opera solo en pesos argentinos." **No incluir selector ni lista de otras monedas en esta versión.**
3. **Márgenes objetivo por categoría** — una fila editable por categoría (panadería, pastelería, bebidas) con el porcentaje objetivo que la IA usa para sugerir precios.
4. **Equipo** — lista de miembros con avatar, nombre y rol (badge), más acción "+ invitar miembro".
5. **Notificaciones** — lista de toggles por tipo de alerta (precio, riesgo de faltante de stock, picos de demanda).

**Acceso:** desde el ícono de engranaje en la barra de navegación superior, visible en dashboard, compras, precios y demanda (no en login/onboarding, donde todavía no hay sesión activa).

---

## 6. Navegación

### Mapa de rutas

| Pantalla | Ruta | Alcanzable desde |
|---|---|---|
| Login | `/login` | Punto de entrada · "cerrar sesión" desde cualquier pantalla autenticada |
| Onboarding | `/onboarding` | Login ("solicitar demo") |
| Dashboard | `/dashboard` | Login ("iniciar sesión"), Onboarding ("continuar" / "omitir"), tab "dashboard", Configuración ("volver") |
| Subir factura | `/compras/subir` | Compras (botón "subir factura") |
| Compras | `/compras` | Tab "compras", Dashboard ("ver todas" de compras recientes), Subir factura ("volver" / "cancelar" / "confirmar y guardar") |
| Precios | `/precios` | Tab "precios", Dashboard ("ver todas" de precios sugeridos) |
| Demanda | `/demanda` | Tab "demanda", Dashboard ("ver detalle" de predicción) |
| Configuración | `/configuracion` | Ícono de engranaje en dashboard / compras / precios / demanda |

### Flujo principal

```
login ──(iniciar sesión)──────────────► dashboard
  │                                        │  ▲
  └─(solicitar demo)──► onboarding ────────┘  │
                        (continuar/omitir)     │
                                                │
dashboard ◄──────────────► compras ──► subir factura
    │      (tabs / links)     │         (vuelve a compras
    │                         │          al cancelar o confirmar)
    ├──────────────────────► precios
    │
    └──────────────────────► demanda

dashboard / compras / precios / demanda ──(engranaje)──► configuración ──(volver)──► dashboard

cualquier pantalla autenticada ──(cerrar sesión)──► login
```

Las 4 pantallas núcleo (dashboard, compras, precios, demanda) comparten la misma barra de navegación superior, por lo que la navegación entre ellas es lateral e inmediata (un clic en el tab correspondiente). Configuración y subir factura son pantallas "hijas" a las que se entra desde un punto específico y de las que siempre se puede volver con un link explícito, sin depender del botón "atrás" del navegador.

---

## 7. Accesibilidad y estados

- Contraste mínimo AA entre texto y fondo en todas las combinaciones de la tabla de color (§3.1); en particular, verificar `text-muted` (`#B08D6F`) sobre `bg` (`#FBF1E7`), que es la combinación de menor contraste usada.
- Todo estado (badges, alertas, niveles de confianza) se comunica con color **y** texto — nunca color solamente — para no depender de la percepción de color del usuario.
- Los botones deshabilitados o informativos (ej. "al día" en precios) deben distinguirse visualmente de los accionables (ej. "aplicar"), con menor contraste y cursor por defecto en vez de pointer.
- Foco de teclado visible en todos los elementos interactivos (inputs, botones, tabs, chips, toggles) — no definido explícitamente en el wireframe visual, pero requerido en la implementación.

---

## 8. Fuera de alcance / próximos pasos

- Selector y soporte de múltiples monedas (explícitamente descartado por ahora — solo ARS).
- Captura de factura por cámara de celular / flujo mobile del módulo de compras.
- Pasos 2 y 3 del onboarding (catálogo inicial de productos, confirmación final).
- Estados de error y validación de formularios (login, onboarding, configuración).
- Versión mobile/responsive del producto completo — el alcance actual es desktop únicamente.
- Alta fidelidad visual: este documento define estructura, contenido y tokens de estilo; tipografía definitiva, micro-interacciones y assets finales quedan para la etapa de diseño visual en Figma u otra herramienta.
