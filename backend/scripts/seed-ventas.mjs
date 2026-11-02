// Carga 8 semanas de ventas diarias de demo en Medianube-Ventas para probar la predicción de demanda.
// Usa los mismos productos que seed-precios.mjs y un patrón semanal (sábado alto, domingo bajo) con
// una variación determinística, así que es idempotente: volver a correrlo pisa los mismos ítems.
// Las fechas terminan ayer (hora de Argentina) para que caigan en la ventana del modelo.
//
// Uso (desde backend/, después de `npm ci`): node scripts/seed-ventas.mjs <usuarioID> [semanas]
// Ej.: node scripts/seed-ventas.mjs user_test_123

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchWriteCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const usuarioID = process.argv[2];
const semanas = Number(process.argv[3] || 8);
if (!usuarioID || !Number.isInteger(semanas) || semanas < 1) {
  console.error("Uso: node scripts/seed-ventas.mjs <usuarioID> [semanas]");
  process.exit(1);
}

const region = process.env.AWS_REGION || "us-east-2";
const TABLA_VENTAS = process.env.TABLA_VENTAS || "Medianube-Ventas";
const cliente = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

// Unidades promedio por día de la semana (0 = domingo … 6 = sábado).
const productos = {
  "medialuna-manteca": [90, 160, 150, 155, 165, 220, 320],
  "pan-frances": [12, 38, 35, 36, 40, 48, 55],
  "torta-chocolate": [18, 6, 5, 6, 7, 12, 22],
  "alfajor-maicena": [25, 30, 28, 30, 32, 40, 45],
};

const hoyAR = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
const sumarDias = (f, d) => {
  const [a, m, dia] = f.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, dia + d)).toISOString().slice(0, 10);
};

// Variación determinística de ±10 % a partir de la fecha y el producto.
function ruido(semilla) {
  let h = 0;
  for (const c of semilla) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 0.9 + (h % 1000) / 5000;
}

const items = [];
for (let i = 1; i <= semanas * 7; i++) {
  const fecha = sumarDias(hoyAR, -i);
  const dia = new Date(`${fecha}T00:00:00Z`).getUTCDay();
  for (const [productoID, patron] of Object.entries(productos)) {
    items.push({
      usuarioID,
      fechaProducto: `${fecha}#${productoID}`,
      fecha,
      productoID,
      cantidad: Math.round(patron[dia] * ruido(`${fecha}#${productoID}`)),
      origen: "seed",
    });
  }
}

for (let i = 0; i < items.length; i += 25) {
  let pendientes = { [TABLA_VENTAS]: items.slice(i, i + 25).map((Item) => ({ PutRequest: { Item } })) };
  for (let intento = 0; pendientes && Object.keys(pendientes).length > 0; intento++) {
    if (intento >= 5) throw new Error("No se pudieron escribir todas las ventas.");
    if (intento > 0) await new Promise((r) => setTimeout(r, 200 * 2 ** intento));
    const { UnprocessedItems } = await cliente.send(new BatchWriteCommand({ RequestItems: pendientes }));
    pendientes = UnprocessedItems;
  }
}

console.log(`✔ ${items.length} ventas (${semanas} semanas hasta ${sumarDias(hoyAR, -1)}) en ${TABLA_VENTAS} para ${usuarioID}`);
