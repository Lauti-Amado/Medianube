// Carga datos de demo para el motor de precios: productos con receta y facturas históricas.
// Las fechas son relativas a hoy para que caigan dentro de la ventana de historial (90 días).
// Es idempotente: los IDs son fijos, así que volver a correrlo pisa los mismos ítems de demo.
//
// Uso (desde backend/, después de `npm ci`): node scripts/seed-precios.mjs <usuarioID>
// Ej.: node scripts/seed-precios.mjs user_test_123

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchWriteCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const usuarioID = process.argv[2];
if (!usuarioID) {
  console.error("Uso: node scripts/seed-precios.mjs <usuarioID>");
  process.exit(1);
}

const region = process.env.AWS_REGION || "us-east-2";
const TABLA_PRODUCTOS = process.env.TABLA_PRODUCTOS || "Medianube-Productos";
const TABLA_FACTURAS = process.env.TABLA_FACTURAS || "Medianube-Facturas";

const cliente = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

const productos = [
  {
    productoID: "medialuna-manteca",
    nombre: "Medialunas de manteca (u.)",
    categoria: "panadería",
    precioActual: 420,
    receta: [
      { insumo: "harina 000", cantidad: 45, unidad: "g" },
      { insumo: "manteca", cantidad: 15, unidad: "g" },
      { insumo: "azucar", cantidad: 8, unidad: "g" },
    ],
  },
  {
    productoID: "pan-frances",
    nombre: "Pan francés (kg)",
    categoria: "panadería",
    precioActual: 2100,
    receta: [
      { insumo: "harina 000", cantidad: 0.65, unidad: "kg" },
      { insumo: "levadura fresca", cantidad: 15, unidad: "g" },
    ],
  },
  {
    productoID: "torta-chocolate",
    nombre: "Torta de chocolate (porción)",
    categoria: "pastelería",
    precioActual: 1800,
    receta: [
      { insumo: "harina 0000", cantidad: 30, unidad: "g" },
      { insumo: "manteca", cantidad: 25, unidad: "g" },
      { insumo: "azucar", cantidad: 30, unidad: "g" },
      { insumo: "dulce de leche repostero", cantidad: 40, unidad: "g" },
    ],
    margenObjetivo: 0.65,
  },
  // Sin receta: el motor lo informa en productosSinReceta.
  { productoID: "alfajor-maicena", nombre: "Alfajor de maicena (u.)", categoria: "pastelería", precioActual: 650 },
];

function haceDias(dias) {
  return new Date(Date.now() - dias * 86_400_000).toISOString();
}

// Precios crecientes (inflación) para que haya historial con el que comparar el ticket nuevo.
const facturas = [75, 50, 25, 10].map((dias, i) => {
  const fecha = haceDias(dias);
  return {
    usuarioID,
    facturaID: `${fecha}#seed-${i + 1}`,
    fecha: fecha.slice(0, 10),
    proveedor: "Molino Cañuelas",
    estado: "procesada",
    items: [
      { descripcion: "Harina 000 x 25 kg", cantidad: 4, precioUnitario: 6200 + i * 300 },
      { descripcion: "Harina 0000 x 25 kg", cantidad: 2, precioUnitario: 7000 + i * 300 },
      { descripcion: "Manteca x 5 kg", cantidad: 2, precioUnitario: 5600 + i * 150 },
      { descripcion: "Azúcar común x 50 kg", cantidad: 1, precioUnitario: 11000 + i * 400 },
      { descripcion: "Levadura fresca x 500 g", cantidad: 6, precioUnitario: 950 + i * 40 },
      { descripcion: "Dulce de leche repostero 4 kg", cantidad: 2, precioUnitario: 3900 + i * 120 },
    ],
  };
});

async function escribir(tabla, items) {
  await cliente.send(new BatchWriteCommand({ RequestItems: { [tabla]: items.map((Item) => ({ PutRequest: { Item } })) } }));
}

await escribir(TABLA_PRODUCTOS, productos.map((p) => ({ usuarioID, ...p })));
await escribir(TABLA_FACTURAS, facturas);
console.log(`✔ ${productos.length} productos en ${TABLA_PRODUCTOS} y ${facturas.length} facturas en ${TABLA_FACTURAS} para ${usuarioID}`);
