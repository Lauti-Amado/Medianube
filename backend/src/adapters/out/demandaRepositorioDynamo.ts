// Adaptador de salida: implementa DemandaRepositorioPort sobre DynamoDB
// (Medianube-Ventas, Medianube-Productos y Medianube-Predicciones).

import { type DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { VentaDiaria } from "../../domain/demanda/tipos";
import type { DemandaRepositorioPort, ProductoCatalogo } from "../../ports/demanda";
import { crearClienteDocumentos, escribirEnLotes } from "./dynamo";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

type Item = Record<string, unknown>;

function aNumero(valor: unknown): number {
  if (typeof valor === "number") return valor;
  if (typeof valor === "string" && valor.trim() !== "") return Number(valor.replace(",", "."));
  return Number.NaN;
}

/**
 * Normaliza una fila de Ventas. Todavía no hay un productor oficial de esta tabla, así que se
 * aceptan nombres alternativos para la cantidad y se toman fecha y productoID de la SK si faltan.
 */
export function mapearVenta(item: Item): VentaDiaria | null {
  const sk = typeof item.fechaProducto === "string" ? item.fechaProducto : "";
  const separador = sk.indexOf("#");
  const fecha = typeof item.fecha === "string" ? item.fecha.slice(0, 10) : sk.slice(0, Math.max(0, separador));
  const productoID =
    typeof item.productoID === "string" && item.productoID ? item.productoID : separador >= 0 ? sk.slice(separador + 1) : "";
  const cantidad = aNumero(item.cantidad ?? item.unidades ?? item.cantidadVendida);

  if (!FECHA.test(fecha) || !productoID || !Number.isFinite(cantidad) || cantidad < 0) return null;
  return { fecha, productoID, cantidad };
}

export interface OpcionesRepositorioDemanda {
  tablaVentas: string;
  tablaProductos: string;
  tablaPredicciones: string;
  cliente?: DynamoDBDocumentClient;
}

export function crearDemandaRepositorioDynamo({
  tablaVentas,
  tablaProductos,
  tablaPredicciones,
  cliente = crearClienteDocumentos(),
}: OpcionesRepositorioDemanda): DemandaRepositorioPort {
  async function consultarTodo(input: ConstructorParameters<typeof QueryCommand>[0]): Promise<Item[]> {
    const items: Item[] = [];
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const pagina = await cliente.send(new QueryCommand({ ...input, ExclusiveStartKey }));
      items.push(...((pagina.Items ?? []) as Item[]));
      ExclusiveStartKey = pagina.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return items;
  }

  return {
    async listarVentas(usuarioID, desde, hasta) {
      const items = await consultarTodo({
        TableName: tablaVentas,
        KeyConditionExpression: "#u = :u AND #sk BETWEEN :desde AND :hasta",
        ExpressionAttributeNames: { "#u": "usuarioID", "#sk": "fechaProducto" },
        // "￿" ordena después de cualquier productoID: incluye todo el día `hasta`.
        ExpressionAttributeValues: { ":u": usuarioID, ":desde": desde, ":hasta": `${hasta}#￿` },
      });
      return items.map(mapearVenta).filter((v): v is VentaDiaria => v !== null);
    },

    async listarProductos(usuarioID) {
      const items = await consultarTodo({
        TableName: tablaProductos,
        KeyConditionExpression: "#u = :u",
        ProjectionExpression: "#p, #n",
        ExpressionAttributeNames: { "#u": "usuarioID", "#p": "productoID", "#n": "nombre" },
        ExpressionAttributeValues: { ":u": usuarioID },
      });
      return items
        .filter((i) => typeof i.productoID === "string")
        .map((i): ProductoCatalogo => ({
          productoID: i.productoID as string,
          nombre: typeof i.nombre === "string" && i.nombre ? i.nombre : (i.productoID as string),
        }));
    },

    async guardarPredicciones(items) {
      // PutItem por clave (fecha#productoID): volver a correr el mismo día pisa la predicción anterior.
      await escribirEnLotes(cliente, tablaPredicciones, items);
    },
  };
}
