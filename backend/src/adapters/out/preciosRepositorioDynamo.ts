// Adaptador de salida: implementa PreciosRepositorioPort sobre DynamoDB.
// El AWS SDK v3 viene incluido en el runtime Node.js de Lambda, por eso no se empaqueta en el bundle.
//
// Las facturas las escriben otras Lambdas (carga de facturas / listarGastos), por eso los ítems se
// leen con mapeo defensivo: se aceptan los nombres de atributo que usa el frontend y se descartan
// las líneas sin precio válido.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { CompraHistorica, IngredienteReceta, Producto } from "../../domain/precios/tipos";
import type { ConfiguracionPrecios, PreciosRepositorioPort } from "../../ports/precios";

export interface OpcionesPreciosRepositorioDynamo {
  tablaFacturas: string;
  tablaProductos: string;
  tablaConfiguracion: string;
  cliente?: DynamoDBDocumentClient;
}

type Item = Record<string, unknown>;

function texto(...valores: unknown[]): string | null {
  for (const v of valores) if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function numero(...valores: unknown[]): number | null {
  for (const v of valores) {
    const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
    if (v != null && v !== "" && Number.isFinite(n)) return n;
  }
  return null;
}

/** Aplana una factura en líneas de compra. La fecha sale del atributo `fecha` o de la SK `<ISO-fecha>#<uuid>`. */
export function mapearFactura(factura: Item): CompraHistorica[] {
  const fecha = (texto(factura.fecha) ?? texto(factura.facturaID) ?? "").slice(0, 10);
  const proveedor = texto(factura.proveedor);
  const items = Array.isArray(factura.items) ? (factura.items as Item[]) : [];
  return items.flatMap((item) => {
    const insumo = texto(item?.descripcion, item?.producto, item?.nombre);
    const precioUnitario = numero(item?.precioUnitario, item?.precio_unitario, item?.unitPrice, item?.precio);
    if (!insumo || precioUnitario === null || precioUnitario <= 0 || !fecha) return [];
    return [{ insumo, fecha, precioUnitario, unidad: texto(item?.unidad), proveedor }];
  });
}

export function mapearProducto(item: Item): Producto | null {
  const productoID = texto(item.productoID);
  const nombre = texto(item.nombre);
  const precioActual = numero(item.precioActual, item.precio);
  if (!productoID || !nombre || precioActual === null || precioActual <= 0) return null;

  const receta: IngredienteReceta[] = (Array.isArray(item.receta) ? (item.receta as Item[]) : []).flatMap((r) => {
    const insumo = texto(r?.insumo);
    const cantidad = numero(r?.cantidad);
    const unidad = texto(r?.unidad);
    return insumo && cantidad !== null && cantidad > 0 && unidad ? [{ insumo: insumo.toLowerCase(), cantidad, unidad }] : [];
  });
  const margenObjetivo = numero(item.margenObjetivo);
  return {
    productoID,
    nombre,
    categoria: texto(item.categoria),
    precioActual,
    receta,
    margenObjetivo: margenObjetivo !== null && margenObjetivo >= 0 && margenObjetivo < 1 ? margenObjetivo : null,
  };
}

async function consultarTodo(cliente: DynamoDBDocumentClient, comando: Omit<QueryCommand["input"], "ExclusiveStartKey">): Promise<Item[]> {
  const items: Item[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const pagina = await cliente.send(new QueryCommand({ ...comando, ExclusiveStartKey }));
    items.push(...((pagina.Items ?? []) as Item[]));
    ExclusiveStartKey = pagina.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

export function crearPreciosRepositorioDynamo({
  tablaFacturas,
  tablaProductos,
  tablaConfiguracion,
  cliente = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  }),
}: OpcionesPreciosRepositorioDynamo): PreciosRepositorioPort {
  return {
    async listarCompras(usuarioID, desde) {
      const facturas = await consultarTodo(cliente, {
        TableName: tablaFacturas,
        // La SK empieza con la fecha ISO, así que el rango por fecha es una condición de clave (sin Scan).
        KeyConditionExpression: "#u = :u AND #f >= :desde",
        ExpressionAttributeNames: { "#u": "usuarioID", "#f": "facturaID" },
        ExpressionAttributeValues: { ":u": usuarioID, ":desde": desde },
      });
      return facturas.flatMap(mapearFactura);
    },

    async listarProductos(usuarioID) {
      const items = await consultarTodo(cliente, {
        TableName: tablaProductos,
        KeyConditionExpression: "#u = :u",
        ExpressionAttributeNames: { "#u": "usuarioID" },
        ExpressionAttributeValues: { ":u": usuarioID },
      });
      return items.map(mapearProducto).filter((p): p is Producto => p !== null);
    },

    async obtenerConfiguracion(usuarioID) {
      const { Item } = await cliente.send(
        new GetCommand({
          TableName: tablaConfiguracion,
          Key: { usuarioID },
          ProjectionExpression: "usuarioID, margenObjetivo, tipoNegocio",
        })
      );
      if (!Item) return null;
      const margenObjetivo = numero(Item.margenObjetivo);
      const configuracion: ConfiguracionPrecios = {
        margenObjetivo: margenObjetivo !== null && margenObjetivo >= 0 && margenObjetivo < 1 ? margenObjetivo : null,
        tipoNegocio: texto(Item.tipoNegocio),
      };
      return configuracion;
    },

    // UpdateItem (y no PutItem) para no pisar receta, precio ni otros atributos del producto.
    async guardarSugerencias(usuarioID, sugerencias) {
      await Promise.all(
        sugerencias.map((sugerencia) =>
          cliente.send(
            new UpdateCommand({
              TableName: tablaProductos,
              Key: { usuarioID, productoID: sugerencia.productoID },
              UpdateExpression: "SET #s = :s",
              ConditionExpression: "attribute_exists(productoID)",
              ExpressionAttributeNames: { "#s": "sugerencia" },
              ExpressionAttributeValues: { ":s": sugerencia },
            })
          )
        )
      );
    },
  };
}
