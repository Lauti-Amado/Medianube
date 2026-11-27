
import { randomUUID } from "node:crypto";

import {
  DynamoDBClient
} from "@aws-sdk/client-dynamodb";

import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  GetCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";

// ============================================================
// 1. CONFIGURACIÓN
// ============================================================

const client = new DynamoDBClient({});

const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true
  }
});

const TABLA_RECETAS =
  process.env.TABLA_RECETAS || "Receta-nueva";

const TABLA_PRODUCTOS =
  process.env.TABLA_PRODUCTOS || "Producto";

const TABLA_GASTOS =
  process.env.TABLA_GASTOS || "Gastos";

const TABLA_SUGERENCIAS =
  process.env.TABLA_SUGERENCIAS || "Sugerencia-precio";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const MODELO_GEMINI =
  process.env.MODELO_GEMINI || "gemini-3.5-flash-lite";

const CORS_ORIGIN =
  process.env.CORS_ORIGIN || "*";

const MARGEN_OBJETIVO = 0.60;
const MARGEN_MINIMO = 0.30;
const TOPE_SUBA = 0.25;

const TIMEOUT_GEMINI_MS = 22000;

// ============================================================
// 2. RESPUESTAS HTTP
// ============================================================

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": CORS_ORIGIN,
      "Access-Control-Allow-Headers":
        "Content-Type,Authorization",
      "Access-Control-Allow-Methods": "OPTIONS,GET,POST"
    },
    body: JSON.stringify(body)
  };
}

// ============================================================
// 3. OBTENER MÉTODO Y RUTA
// ============================================================

function getMethod(event) {
  return (
    event?.requestContext?.http?.method ||
    event?.httpMethod ||
    "POST"
  ).toUpperCase();
}

function getPath(event) {
  return (
    event?.rawPath ||
    event?.requestContext?.http?.path ||
    event?.path ||
    "/"
  ).replace(/\/+$/, "") || "/";
}

// ============================================================
// 4. LEER BODY
// ============================================================

function parseBody(event) {
  if (!event?.body) {
    return {};
  }

  try {
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;

    return typeof rawBody === "string"
      ? JSON.parse(rawBody)
      : rawBody;

  } catch {
    throw new Error("El cuerpo de la solicitud no es un JSON válido.");
  }
}

// ============================================================
// 5. CONSULTAR TODAS LAS PÁGINAS DE UNA TABLA
// ============================================================

async function scanAll(tableName) {
  const items = [];
  let lastKey;

  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastKey
      })
    );

    items.push(...(result.Items ?? []));

    lastKey = result.LastEvaluatedKey;

  } while (lastKey);

  return items;
}

// ============================================================
// 6. NORMALIZACIÓN DE DATOS
// ============================================================

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function unwrapDynamoValue(value) {
  if (Array.isArray(value)) {
    return value.map(unwrapDynamoValue);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  if (Object.keys(value).length === 1) {
    if ("S" in value) return value.S;
    if ("N" in value) return Number(value.N);
    if ("BOOL" in value) return value.BOOL;
    if ("NULL" in value) return null;

    if ("M" in value) {
      return unwrapDynamoValue(value.M);
    }

    if ("L" in value) {
      return unwrapDynamoValue(value.L);
    }
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, val]) => [
      key,
      unwrapDynamoValue(val)
    ])
  );
}

// ============================================================
// 7. CONVERSIÓN DE UNIDADES
// ============================================================

function getUnitInfo(unit) {
  const normalized = normalizeText(unit);

  const units = {
    kg: { dimension: "masa", factor: 1000 },
    kilo: { dimension: "masa", factor: 1000 },
    kilos: { dimension: "masa", factor: 1000 },

    g: { dimension: "masa", factor: 1 },
    gr: { dimension: "masa", factor: 1 },
    gramo: { dimension: "masa", factor: 1 },
    gramos: { dimension: "masa", factor: 1 },

    l: { dimension: "volumen", factor: 1000 },
    lt: { dimension: "volumen", factor: 1000 },
    litro: { dimension: "volumen", factor: 1000 },
    litros: { dimension: "volumen", factor: 1000 },

    ml: { dimension: "volumen", factor: 1 },
    mililitro: { dimension: "volumen", factor: 1 },
    mililitros: { dimension: "volumen", factor: 1 },

    u: { dimension: "unidad", factor: 1 },
    un: { dimension: "unidad", factor: 1 },
    unidad: { dimension: "unidad", factor: 1 },
    unidades: { dimension: "unidad", factor: 1 }
  };

  return units[normalized] ?? null;
}

// Devuelve el precio de una unidad de destino.
// Ejemplo: precio por kg convertido a precio por g.

function convertUnitPrice(
  pricePerSourceUnit,
  sourceUnit,
  targetUnit
) {
  const source = getUnitInfo(sourceUnit);
  const target = getUnitInfo(targetUnit);

  if (!source || !target) {
    return null;
  }

  if (source.dimension !== target.dimension) {
    return null;
  }

  return pricePerSourceUnit *
    (target.factor / source.factor);
}

// ============================================================
// 8. NORMALIZAR RECETAS
// ============================================================

function normalizeRecipe(recipe) {
  const rawIngredients = unwrapDynamoValue(
    recipe.ingredientes ?? recipe.receta ?? []
  );

  if (!Array.isArray(rawIngredients)) {
    return [];
  }

  return rawIngredients
    .map((item) => {
      const ingredient = unwrapDynamoValue(item);

      return {
        nombre: String(ingredient.nombre ?? "").trim(),
        cantidad: Number(ingredient.cantidad),
        unidad: String(ingredient.unidad ?? "").trim()
      };
    })
    .filter((ingredient) =>
      ingredient.nombre &&
      Number.isFinite(ingredient.cantidad) &&
      ingredient.cantidad > 0 &&
      ingredient.unidad
    );
}

// ============================================================
// 9. NORMALIZAR GASTOS
// ============================================================

function normalizeExpense(expense) {
  const item = unwrapDynamoValue(expense);

  return {
    gastoID: item.gastoID,

    // El nombre real del atributo en DynamoDB es cetegoria.
    // También aceptamos categoria por compatibilidad.
    categoria: String(
      item.cetegoria ??
      item.categoria ??
      item.ingrediente ??
      item.nombre ??
      ""
    ).trim(),

    cantidad: Number(item.cantidad),
    monto: Number(item.monto),

    unidad: String(item.unidad ?? "").trim(),

    fecha: String(item.fecha ?? ""),

    proveedor: String(item.proveedor ?? "")
  };
}

// ============================================================
// 10. AGRUPAR COMPRAS POR INGREDIENTE
// ============================================================

function groupExpensesByIngredient(expenses) {
  const grouped = new Map();

  for (const rawExpense of expenses) {
    const expense = normalizeExpense(rawExpense);

    if (
      !expense.categoria ||
      !Number.isFinite(expense.cantidad) ||
      expense.cantidad <= 0 ||
      !Number.isFinite(expense.monto) ||
      expense.monto <= 0 ||
      !getUnitInfo(expense.unidad)
    ) {
      continue;
    }

    const key = normalizeText(expense.categoria);

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

    grouped.get(key).push({
      ...expense,
      precioUnitario: expense.monto / expense.cantidad
    });
  }

  // Ordenar las compras por fecha descendente.
  for (const purchases of grouped.values()) {
    purchases.sort((a, b) =>
      b.fecha.localeCompare(a.fecha)
    );
  }

  return grouped;
}

// ============================================================
// 11. CALCULAR COSTOS DE CADA PRODUCTO
// ============================================================

function calculateProductCosts(
  recipes,
  products,
  expenses
) {
  const expensesByIngredient =
    groupExpensesByIngredient(expenses);

  const productsById = new Map(
    products.map((product) => [
      String(product.productoID),
      unwrapDynamoValue(product)
    ])
  );

  const calculableProducts = [];
  const productsWithoutCost = [];

  for (const rawRecipe of recipes) {
    const recipe = unwrapDynamoValue(rawRecipe);

    const productoID = String(
      recipe.productoID ?? ""
    );

    const product = productsById.get(productoID);

    if (!productoID || !product) {
      productsWithoutCost.push({
        productoID,
        motivo: "No existe el producto en la tabla Producto."
      });

      continue;
    }

    const ingredients = normalizeRecipe(recipe);

    if (ingredients.length === 0) {
      productsWithoutCost.push({
        productoID,
        nombre: recipe.nombre,
        motivo: "La receta no tiene ingredientes válidos."
      });

      continue;
    }

    let costoActual = 0;
    let costoAnterior = 0;

    let hasPreviousCosts = true;
    let allIngredientsCalculated = true;

    const detailIngredients = [];

    for (const ingredient of ingredients) {
      const key = normalizeText(ingredient.nombre);

      const purchases =
        expensesByIngredient.get(key) ?? [];

      if (purchases.length === 0) {
        allIngredientsCalculated = false;

        detailIngredients.push({
          nombre: ingredient.nombre,
          cantidad: ingredient.cantidad,
          unidad: ingredient.unidad,
          calculado: false,
          motivo: "No hay compras registradas."
        });

        continue;
      }

      const latestPurchase = purchases[0];
      const previousPurchase = purchases[1];

      const latestUnitPrice = convertUnitPrice(
        latestPurchase.precioUnitario,
        latestPurchase.unidad,
        ingredient.unidad
      );

      if (
        latestUnitPrice === null ||
        !Number.isFinite(latestUnitPrice)
      ) {
        allIngredientsCalculated = false;

        detailIngredients.push({
          nombre: ingredient.nombre,
          cantidad: ingredient.cantidad,
          unidad: ingredient.unidad,
          calculado: false,
          motivo: "No se pudieron convertir las unidades."
        });

        continue;
      }

      const ingredientCost =
        ingredient.cantidad * latestUnitPrice;

      costoActual += ingredientCost;

      let previousIngredientCost = null;

      if (previousPurchase) {
        const previousUnitPrice = convertUnitPrice(
          previousPurchase.precioUnitario,
          previousPurchase.unidad,
          ingredient.unidad
        );

        if (previousUnitPrice !== null) {
          previousIngredientCost =
            ingredient.cantidad * previousUnitPrice;

          costoAnterior += previousIngredientCost;
        } else {
          hasPreviousCosts = false;
        }

      } else {
        hasPreviousCosts = false;
      }

      detailIngredients.push({
        nombre: ingredient.nombre,
        cantidad: ingredient.cantidad,
        unidad: ingredient.unidad,

        costoUnitario: roundMoney(latestUnitPrice),

        costoTotal: roundMoney(ingredientCost),

        costoAnterior: previousIngredientCost === null
          ? null
          : roundMoney(previousIngredientCost),

        fechaUltimaCompra: latestPurchase.fecha,

        proveedorUltimaCompra: latestPurchase.proveedor,

        calculado: true
      });
    }

    if (!allIngredientsCalculated) {
      productsWithoutCost.push({
        productoID,
        nombre: recipe.nombre ?? product.nombre,
        motivo: "No se pudo calcular el costo de todos los ingredientes.",
        ingredientes: detailIngredients
      });

      continue;
    }

    const precioActual = Number(product.precioActual);

    if (
      !Number.isFinite(precioActual) ||
      precioActual <= 0
    ) {
      productsWithoutCost.push({
        productoID,
        nombre: product.nombre,
        motivo: "El producto no tiene un precioActual válido."
      });

      continue;
    }

    const variationCost = hasPreviousCosts &&
      costoAnterior > 0
        ? ((costoActual - costoAnterior) / costoAnterior) * 100
        : null;

    calculableProducts.push({
      productoID,

      nombre: product.nombre ?? recipe.nombre,

      unidadProducto:
        product.unidadProducto ?? recipe.unidadProducto,

      precioActual: roundMoney(precioActual),

      costoActual: roundMoney(costoActual),

      costoAnterior: hasPreviousCosts
        ? roundMoney(costoAnterior)
        : null,

      variacionCosto: variationCost === null
        ? null
        : roundMoney(variationCost),

      ingredientes: detailIngredients
    });
  }

  return {
    calculableProducts,
    productsWithoutCost
  };
}

// ============================================================
// 12. CONSTRUIR PROMPT PARA GEMINI
// ============================================================

function buildPrompt(products) {
  return `
Sos un especialista en costos y precios de venta
para negocios gastronómicos de Argentina.

Tu tarea es analizar los productos y proponer precios
de venta razonables basándote exclusivamente en
los datos proporcionados.

CONTEXTO:

- Moneda: pesos argentinos (ARS).
- Margen objetivo: ${MARGEN_OBJETIVO * 100}%.
- Margen mínimo permitido: ${MARGEN_MINIMO * 100}%.
- Aumento de precio de referencia: ${TOPE_SUBA * 100}%.
- Los precios actuales son los registrados en la base de datos.
- Los costos se calcularon utilizando las últimas compras
  registradas de cada ingrediente.

REGLAS:

1. Analizá el costo total de cada producto.
2. Compará el costo actual con el anterior cuando exista.
3. Considerá el precio actual de venta.
4. Proponé un precio de venta que permita alcanzar
   el margen objetivo siempre que sea comercialmente razonable.
5. Nunca propongas un precio que genere un margen inferior
   al mínimo permitido.
6. No inventes costos, ingredientes ni compras.
7. Si el precio sugerido supera el aumento de referencia,
   explicá brevemente el motivo.
8. No modifiques los precios actuales.
9. Redondeá los precios a números enteros razonables.
10. Devolvé una sugerencia para cada producto recibido.

FÓRMULA DEL MARGEN:

Margen = (Precio de venta - Costo) / Precio de venta

El margen debe ser al menos ${MARGEN_MINIMO * 100}%.

FORMATO DE RESPUESTA:

Devolvé exclusivamente JSON válido, sin Markdown,
con esta estructura:

{
  "sugerencias": [
    {
      "productoID": "identificador",
      "precioSugerido": 3000,
      "razonamiento": "Explicación breve",
      "confianza": "alta"
    }
  ]
}

Los valores permitidos para confianza son:
"alta", "media" y "baja".

DATOS DE LOS PRODUCTOS:

${JSON.stringify(products)}
`;
}

// ============================================================
// 13. LLAMAR A GEMINI
// ============================================================

/**
 * Error de la IA: lleva el motivo para que suggestPrices use el respaldo por reglas
 * (sin_api_key, timeout, error_llm o esquema_invalido) en lugar de responder 500.
 */
function falloIA(mensaje, motivo) {
  return Object.assign(new Error(mensaje), { motivo });
}

async function callGemini(prompt) {
  if (!GEMINI_API_KEY) {
    throw falloIA(
      "No está configurada la variable GEMINI_API_KEY.",
      "sin_api_key"
    );
  }

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    TIMEOUT_GEMINI_MS
  );

  try {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELO_GEMINI}:generateContent`;

    const result = await fetch(url, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
      },

      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],

        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      }),

      signal: controller.signal
    });

    const data = await result.json();

    if (!result.ok) {
      console.error("Error de Gemini:", data);

      throw falloIA(
        data.error?.message ??
        "Gemini no pudo procesar la solicitud.",
        "error_llm"
      );
    }

    const text = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("");

    if (!text) {
      throw falloIA(
        "Gemini devolvió una respuesta vacía.",
        "error_llm"
      );
    }

    try {
      return JSON.parse(text);

    } catch {
      console.error("Respuesta inválida de Gemini:", text);

      throw falloIA(
        "Gemini devolvió un JSON inválido.",
        "esquema_invalido"
      );
    }

  } catch (error) {
    if (error.name === "AbortError") {
      throw falloIA(
        "Se agotó el tiempo de espera de Gemini.",
        "timeout"
      );
    }

    // Un error de red (o cualquier otro al hablar con Gemini) también es una falla de la IA.
    throw error.motivo
      ? error
      : falloIA(error.message ?? "No se pudo consultar a Gemini.", "error_llm");

  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================
// 14. VALIDAR Y NORMALIZAR SUGERENCIAS
// ============================================================

function validateSuggestions(
  geminiResult,
  products
) {
  const rawSuggestions =
    geminiResult?.sugerencias;

  if (!Array.isArray(rawSuggestions)) {
    throw falloIA(
      "Gemini no devolvió una lista de sugerencias válida.",
      "esquema_invalido"
    );
  }

  const productsById = new Map(
    products.map((product) => [
      product.productoID,
      product
    ])
  );

  const seen = new Set();
  const validated = [];

  for (const suggestion of rawSuggestions) {
    const productoID = String(
      suggestion.productoID ?? ""
    );

    const product = productsById.get(productoID);

    if (!product || seen.has(productoID)) {
      continue;
    }

    seen.add(productoID);

    let precioSugerido = Number(
      suggestion.precioSugerido
    );

    if (
      !Number.isFinite(precioSugerido) ||
      precioSugerido <= 0
    ) {
      continue;
    }

    const costoActual = product.costoActual;
    const precioActual = product.precioActual;

    // Garantizar el margen mínimo.
    const precioMinimo =
      costoActual / (1 - MARGEN_MINIMO);

    if (precioSugerido < precioMinimo) {
      precioSugerido = precioMinimo;
    }

    // Redondear hacia arriba para no perder el margen mínimo.
    precioSugerido = Math.ceil(precioSugerido);

    const margenResultante =
      (precioSugerido - costoActual) / precioSugerido;

    const variacionPrecio =
      ((precioSugerido - precioActual) / precioActual) * 100;

    const superaTope =
      variacionPrecio > TOPE_SUBA * 100;

    let confianza = [
      "alta",
      "media",
      "baja"
    ].includes(suggestion.confianza)
      ? suggestion.confianza
      : "media";

    if (superaTope) {
      confianza = "baja";
    }

    validated.push({
      productoID,

      nombre: product.nombre,

      unidadProducto: product.unidadProducto,

      precioActual,

      costoActual,

      costoAnterior: product.costoAnterior,

      variacionCosto: product.variacionCosto,

      precioSugerido: precioSugerido,

      variacionPrecio: roundMoney(variacionPrecio),

      margenResultante: roundMoney(
        margenResultante * 100
      ),

      razonamiento: String(
        suggestion.razonamiento ?? ""
      ),

      confianza,

      superaTopeSuba: superaTope
    });
  }

  return validated;
}

// ============================================================
// 14 b. RESPALDO POR REGLAS (si la IA falla)
// ============================================================

/**
 * Precios sin IA: lleva cada producto al margen objetivo (precio = costo / (1 - margen)).
 * Si el precio actual ya llega a ese margen, lo deja igual. El resultado pasa por
 * validateSuggestions, que aplica el margen mínimo, el redondeo y el tope de suba.
 */
export function preciosPorReglas(products) {
  return {
    sugerencias: products.map((product) => {
      const precioObjetivo =
        product.costoActual / (1 - MARGEN_OBJETIVO);

      const alcanzaObjetivo =
        product.precioActual >= precioObjetivo;

      return {
        productoID: product.productoID,

        precioSugerido: alcanzaObjetivo
          ? product.precioActual
          : precioObjetivo,

        razonamiento: alcanzaObjetivo
          ? `Calculado sin IA: el precio actual ya alcanza el margen objetivo del ${MARGEN_OBJETIVO * 100}%.`
          : `Calculado sin IA: precio para llegar al margen objetivo del ${MARGEN_OBJETIVO * 100}% con el costo actual.`,

        confianza: "media"
      };
    })
  };
}

// ============================================================
// 15. GUARDAR SUGERENCIAS EN DYNAMODB
// ============================================================

async function saveSuggestions(suggestions, procedencia) {
  const fechaGeneracion = new Date().toISOString();

  const sugerenciaPrecioID =
    `sug-${randomUUID()}`;

  const item = {
    sugerenciaPrecioID,

    fechaGeneracion,

    sugerencias: suggestions,

    estado: "pendiente",

    // origen, degradado y motivoDegradacion: el GET los devuelve para mostrar el aviso
    ...procedencia
  };

  await ddb.send(
    new PutCommand({
      TableName: TABLA_SUGERENCIAS,
      Item: item,

      ConditionExpression:
        "attribute_not_exists(sugerenciaPrecioID)"
    })
  );

  return {
    sugerenciaPrecioID,
    fechaGeneracion
  };
}

// ============================================================
// 16. FUNCIÓN PRINCIPAL
// ============================================================

async function suggestPrices() {
  // Leer las tres tablas.
  const [
    recipes,
    products,
    expenses
  ] = await Promise.all([
    scanAll(TABLA_RECETAS),
    scanAll(TABLA_PRODUCTOS),
    scanAll(TABLA_GASTOS)
  ]);

  if (recipes.length === 0) {
    throw new Error(
      "No hay recetas registradas en Receta-nueva."
    );
  }

  if (products.length === 0) {
    throw new Error(
      "No hay productos registrados en Producto."
    );
  }

  if (expenses.length === 0) {
    throw new Error(
      "No hay gastos registrados en Gastos."
    );
  }

  // Calcular costos.
  const {
    calculableProducts,
    productsWithoutCost
  } = calculateProductCosts(
    recipes,
    products,
    expenses
  );

  if (calculableProducts.length === 0) {
    throw new Error(
      "No hay productos con costos calculables. " +
      "Revisá que las categorías de Gastos coincidan " +
      "con los nombres de los ingredientes de las recetas."
    );
  }

  // Consultar Gemini. Si la IA falla (sin clave, timeout, error o respuesta
  // inválida), se calcula por reglas con las mismas validaciones.
  let suggestions;
  let procedencia = {
    origen: "llm",
    degradado: false,
    motivoDegradacion: null
  };

  try {
    const prompt = buildPrompt(calculableProducts);

    const geminiResult = await callGemini(prompt);

    suggestions = validateSuggestions(
      geminiResult,
      calculableProducts
    );

    if (suggestions.length === 0) {
      throw falloIA(
        "Gemini no devolvió sugerencias válidas para ningún producto.",
        "esquema_invalido"
      );
    }

  } catch (error) {
    if (!error.motivo) {
      throw error;
    }

    console.warn(JSON.stringify({
      mensaje: "La IA falló: se calculan los precios por reglas",
      motivo: error.motivo,
      detalle: error.message
    }));

    procedencia = {
      origen: "reglas",
      degradado: true,
      motivoDegradacion: error.motivo
    };

    suggestions = validateSuggestions(
      preciosPorReglas(calculableProducts),
      calculableProducts
    );
  }

  suggestions = suggestions.map((suggestion) => ({
    ...suggestion,
    origen: procedencia.origen
  }));

  // Guardar el resultado.
  const saved = await saveSuggestions(suggestions, procedencia);

  return {
    success: true,

    mensaje: procedencia.degradado
      ? "La IA no respondió: los precios se calcularon con reglas."
      : "Sugerencias generadas correctamente.",

    ...procedencia,

    sugerenciaPrecioID: saved.sugerenciaPrecioID,

    fechaGeneracion: saved.fechaGeneracion,

    estado: "pendiente",

    cantidadProductosAnalizados:
      calculableProducts.length,

    cantidadSugerencias:
      suggestions.length,

    cantidadProductosSinCosto:
      productsWithoutCost.length,

    sugerencias: suggestions,

    productosSinCosto:
      productsWithoutCost
  };
}


// ============================================================
// 17. FUNCIÓN APLICAR PRECIO INDIVIDUAL
// ============================================================

async function aplicarPrecioIndividual(event) {
  try {
    const body = parseBody(event);

    const { sugerenciaPrecioID, productoID } = body;

    if (!sugerenciaPrecioID || !productoID) {
      return response(400, {
        success: false,
        mensaje: "Se requiere sugerenciaPrecioID y productoID."
      });
    }

    // 1. Buscar la sugerencia guardada.
    const resultadoSugerencia = await ddb.send(
      new GetCommand({
        TableName: TABLA_SUGERENCIAS,
        Key: { sugerenciaPrecioID },
        ConsistentRead: true
      })
    );

    const sugerenciaGuardada = resultadoSugerencia.Item;

    if (!sugerenciaGuardada) {
      return response(404, {
        success: false,
        mensaje: "No se encontró la sugerencia solicitada."
      });
    }

    if (!Array.isArray(sugerenciaGuardada.sugerencias)) {
      return response(400, {
        success: false,
        mensaje: "La sugerencia no contiene productos válidos."
      });
    }

    // 2. Buscar el producto dentro de la sugerencia.
    const indice = sugerenciaGuardada.sugerencias.findIndex(
      item => item.productoID === productoID
    );

    if (indice === -1) {
      return response(404, {
        success: false,
        mensaje: "El producto no pertenece a esta sugerencia."
      });
    }

    const itemSugerido = sugerenciaGuardada.sugerencias[indice];

    // 3. Evitar aplicar dos veces el mismo precio.
    if (itemSugerido.estadoAplicacion === "aplicada") {
      return response(409, {
        success: false,
        mensaje: "Este precio ya fue aplicado anteriormente."
      });
    }

    const precioActual = Number(itemSugerido.precioActual);
    const precioSugerido = Number(itemSugerido.precioSugerido);

    if (
      !Number.isFinite(precioActual) ||
      !Number.isFinite(precioSugerido) ||
      precioActual <= 0 ||
      precioSugerido <= 0
    ) {
      return response(400, {
        success: false,
        mensaje: "Los precios de la sugerencia no son válidos."
      });
    }

    // 4. Determinar el estado general de la sugerencia.
    const todasAplicadas = sugerenciaGuardada.sugerencias.every(
      (item, i) =>
        i === indice || item.estadoAplicacion === "aplicada"
    );

    const nuevoEstado = todasAplicadas ? "aplicada" : "parcial";

    const fechaAplicacion = new Date().toISOString();

    // 5. Actualizar Producto y Sugerencia-precio
    // mediante una única transacción.
    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: TABLA_PRODUCTOS,

              Key: {
                productoID
              },

              UpdateExpression:
                "SET precioActual = :nuevoPrecio",

              ConditionExpression:
                "precioActual = :precioEsperado",

              ExpressionAttributeValues: {
                ":nuevoPrecio": precioSugerido,
                ":precioEsperado": precioActual
              }
            }
          },
          {
            Update: {
              TableName: TABLA_SUGERENCIAS,

              Key: {
                sugerenciaPrecioID
              },

              UpdateExpression: `
                SET #sugerencias[${indice}].#estadoAplicacion = :aplicada,
                    #sugerencias[${indice}].#fechaAplicacion = :fecha,
                    #estado = :nuevoEstado
              `,

              ConditionExpression: `
                (#estado = :pendiente OR #estado = :parcial)
                AND (
                  attribute_not_exists(#sugerencias[${indice}].#estadoAplicacion)
                  OR #sugerencias[${indice}].#estadoAplicacion = :pendiente
                )
              `,

              ExpressionAttributeNames: {
                "#sugerencias": "sugerencias",
                "#estadoAplicacion": "estadoAplicacion",
                "#fechaAplicacion": "fechaAplicacion",
                "#estado": "estado"
              },

              ExpressionAttributeValues: {
                ":aplicada": "aplicada",
                ":pendiente": "pendiente",
                ":parcial": "parcial",
                ":nuevoEstado": nuevoEstado,
                ":fecha": fechaAplicacion
              }
            }
          }
        ]
      })
    );

    return response(200, {
      success: true,
      mensaje: "Precio aplicado correctamente.",
      sugerenciaPrecioID,
      productoID,
      precioAnterior: precioActual,
      precioNuevo: precioSugerido,
      fechaAplicacion,
      estadoAplicacion: "aplicada",
      estadoSugerencia: nuevoEstado
    });

  } catch (error) {
    console.error("Error al aplicar precio:", error);

    if (
      error.name === "TransactionCanceledException" ||
      error.name === "ConditionalCheckFailedException"
    ) {
      return response(409, {
        success: false,
        mensaje:
          "No se pudo aplicar el precio. Es posible que el precio actual haya cambiado o que la sugerencia ya haya sido aplicada."
      });
    }

    return response(500, {
      success: false,
      mensaje: "Error interno al aplicar el precio."
    });
  }
}

// ============================================================
// 18. ÚLTIMA SUGERENCIA GUARDADA (GET /precios/sugerir)
// ============================================================
// Precios y el Dashboard leen esto al entrar, sin llamar a Gemini.
// La IA corre solo con "recalcular con IA" (POST).

/** La sugerencia con la fechaGeneracion más reciente; ignora las filas sin una fecha legible. */
export function elegirUltimaSugerencia(items) {
  let ultima = null;
  let ultimaFecha = -Infinity;

  for (const item of items) {
    const fecha =
      typeof item?.fechaGeneracion === "string"
        ? Date.parse(item.fechaGeneracion)
        : NaN;

    if (!Number.isNaN(fecha) && fecha > ultimaFecha) {
      ultima = item;
      ultimaFecha = fecha;
    }
  }

  return ultima;
}

async function obtenerUltimaSugerencia() {
  try {
    // La tabla tiene una fila por corrida (clave sugerenciaPrecioID): el Scan es chico.
    const ultima = elegirUltimaSugerencia(
      await scanAll(TABLA_SUGERENCIAS)
    );

    if (!ultima) {
      return response(200, {
        success: true,
        mensaje: "Todavía no hay sugerencias guardadas.",
        sugerenciaPrecioID: null,
        fechaGeneracion: null,
        estado: null,
        cantidadSugerencias: 0,
        sugerencias: [],
        productosSinCosto: []
      });
    }

    const sugerencias = Array.isArray(ultima.sugerencias)
      ? ultima.sugerencias
      : [];

    return response(200, {
      success: true,
      mensaje: "Última sugerencia guardada.",
      sugerenciaPrecioID: ultima.sugerenciaPrecioID,
      fechaGeneracion: ultima.fechaGeneracion,
      estado: ultima.estado ?? "pendiente",
      // Las filas anteriores al respaldo por reglas no guardaban el origen: eran todas de la IA.
      origen: ultima.origen ?? "llm",
      degradado: Boolean(ultima.degradado),
      motivoDegradacion: ultima.motivoDegradacion ?? null,
      cantidadSugerencias: sugerencias.length,
      sugerencias,
      productosSinCosto: []
    });

  } catch (error) {
    console.error("Error al leer la última sugerencia:", error);

    return response(500, {
      success: false,
      error: "No se pudo leer la última sugerencia."
    });
  }
}

// ============================================================
// 19. HANDLER DE AWS LAMBDA
// ============================================================

export const handler = async (event) => {
  const method = getMethod(event);
  const path = getPath(event);

  // Preflight CORS.
  if (method === "OPTIONS") {
    return response(200, {
      success: true
    });
  }

  // GET /precios/sugerir: última sugerencia guardada, sin IA.
  if (
    method === "GET" &&
    (path === "/" || path.endsWith("/precios/sugerir"))
  ) {
    return await obtenerUltimaSugerencia();
  }

  if (method !== "POST") {
    return response(405, {
      success: false,
      error: "Método HTTP no permitido."
    });
  }

  // POST /precios/aplicar
  if (path.endsWith("/precios/aplicar")) {
    return await aplicarPrecioIndividual(event);
  }

  // POST /precios/sugerir
  if (
    path === "/" ||
    path.endsWith("/precios/sugerir")
  ) {
    try {
      parseBody(event);

      const result = await suggestPrices();

      return response(200, result);

    } catch (error) {
      console.error(
        "Error en sugerirPrecios-dev:",
        error
      );

      const message = error.message ??
        "Error interno al generar sugerencias.";

      const isClientError =
        message.includes("JSON válido");

      return response(
        isClientError ? 400 : 500,
        {
          success: false,
          error: message
        }
      );
    }
  }

  return response(404, {
    success: false,
    error: `Ruta no encontrada: ${path}`
  });
};

