// Adaptador de salida: implementa ClimaRepositorioPort sobre DynamoDB.
// El AWS SDK v3 viene incluido en el runtime Node.js de Lambda, por eso no se empaqueta en el bundle.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import type { DiaClimaGuardado } from "../../domain/clima/tipos";
import type { ClimaRepositorioPort, ConfiguracionClima } from "../../ports/clima";

const LOTE_MAXIMO = 25; // límite de BatchWriteItem
const REINTENTOS = 3;

const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface OpcionesRepositorioDynamo {
  tablaClima: string;
  tablaConfiguracion: string;
  cliente?: DynamoDBDocumentClient;
}

export function crearClimaRepositorioDynamo({
  tablaClima,
  tablaConfiguracion,
  cliente = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  }),
}: OpcionesRepositorioDynamo): ClimaRepositorioPort {
  return {
    async obtenerConfiguracion(usuarioID) {
      const { Item } = await cliente.send(
        new GetCommand({
          TableName: tablaConfiguracion,
          Key: { usuarioID },
          ProjectionExpression: "usuarioID, ubicacion",
        })
      );
      return (Item as ConfiguracionClima | undefined) ?? null;
    },

    async consultarClima(usuarioID, desde, hasta) {
      const items: DiaClimaGuardado[] = [];
      let ExclusiveStartKey: Record<string, unknown> | undefined;
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
        items.push(...((pagina.Items ?? []) as DiaClimaGuardado[]));
        ExclusiveStartKey = pagina.LastEvaluatedKey;
      } while (ExclusiveStartKey);
      return items;
    },

    async guardarClima(items) {
      for (let i = 0; i < items.length; i += LOTE_MAXIMO) {
        let pendientes: Record<string, Array<{ PutRequest: { Item: Record<string, unknown> } }>> | undefined = {
          [tablaClima]: items
            .slice(i, i + LOTE_MAXIMO)
            .map((Item) => ({ PutRequest: { Item: Item as unknown as Record<string, unknown> } })),
        };
        // BatchWrite puede devolver ítems sin procesar por throttling: reintento con backoff exponencial.
        for (let intento = 0; pendientes && Object.keys(pendientes).length > 0; intento++) {
          if (intento >= REINTENTOS) throw new Error("No se pudieron escribir todos los ítems de clima.");
          if (intento > 0) await esperar(100 * 2 ** intento);
          const { UnprocessedItems } = await cliente.send(new BatchWriteCommand({ RequestItems: pendientes }));
          pendientes = UnprocessedItems as typeof pendientes;
        }
      }
    },

    /** Solo lo usa el refresco programado; el volumen de usuarios del MVP hace aceptable un Scan proyectado. */
    async listarUsuarios() {
      const usuarios: string[] = [];
      let ExclusiveStartKey: Record<string, unknown> | undefined;
      do {
        const pagina = await cliente.send(
          new ScanCommand({
            TableName: tablaConfiguracion,
            ProjectionExpression: "#u",
            ExpressionAttributeNames: { "#u": "usuarioID" },
            ExclusiveStartKey,
          })
        );
        usuarios.push(...(pagina.Items ?? []).map((item) => item.usuarioID as string));
        ExclusiveStartKey = pagina.LastEvaluatedKey;
      } while (ExclusiveStartKey);
      return usuarios;
    },
  };
}
