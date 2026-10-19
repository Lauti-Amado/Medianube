// Acceso a DynamoDB. El AWS SDK v3 viene incluido en el runtime Node.js de Lambda,
// por eso no se empaqueta en el .zip.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

const LOTE_MAXIMO = 25; // límite de BatchWriteItem
const REINTENTOS = 3;

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function crearRepositorio({
  tablaClima,
  tablaConfiguracion,
  cliente = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  }),
}) {
  return {
    async obtenerConfiguracion(usuarioID) {
      const { Item } = await cliente.send(
        new GetCommand({
          TableName: tablaConfiguracion,
          Key: { usuarioID },
          ProjectionExpression: "usuarioID, ubicacion",
        })
      );
      return Item ?? null;
    },

    async consultarClima(usuarioID, desde, hasta) {
      const items = [];
      let ExclusiveStartKey;
      do {
        const pagina = await cliente.send(
          new QueryCommand({
            TableName: tablaClima,
            KeyConditionExpression: "#u = :u AND #f BETWEEN :desde AND :hasta",
            ExpressionAttributeNames: { "#u": "usuarioID", "#f": "fecha" },
            ExpressionAttributeValues: { ":u": usuarioID, ":desde": desde, ":hasta": hasta },
            ExclusiveStartKey,
          })
        );
        items.push(...(pagina.Items ?? []));
        ExclusiveStartKey = pagina.LastEvaluatedKey;
      } while (ExclusiveStartKey);
      return items;
    },

    async guardarClima(items) {
      for (let i = 0; i < items.length; i += LOTE_MAXIMO) {
        let pendientes = {
          [tablaClima]: items.slice(i, i + LOTE_MAXIMO).map((Item) => ({ PutRequest: { Item } })),
        };
        // BatchWrite puede devolver ítems sin procesar por throttling: reintento con backoff exponencial.
        for (let intento = 0; pendientes && Object.keys(pendientes).length > 0; intento++) {
          if (intento >= REINTENTOS) throw new Error("No se pudieron escribir todos los ítems de clima.");
          if (intento > 0) await esperar(100 * 2 ** intento);
          const { UnprocessedItems } = await cliente.send(new BatchWriteCommand({ RequestItems: pendientes }));
          pendientes = UnprocessedItems;
        }
      }
    },

    /** Solo lo usa el refresco programado; el volumen de usuarios del MVP hace aceptable un Scan proyectado. */
    async listarUsuarios() {
      const usuarios = [];
      let ExclusiveStartKey;
      do {
        const pagina = await cliente.send(
          new ScanCommand({
            TableName: tablaConfiguracion,
            ProjectionExpression: "#u",
            ExpressionAttributeNames: { "#u": "usuarioID" },
            ExclusiveStartKey,
          })
        );
        usuarios.push(...(pagina.Items ?? []).map((item) => item.usuarioID));
        ExclusiveStartKey = pagina.LastEvaluatedKey;
      } while (ExclusiveStartKey);
      return usuarios;
    },
  };
}
