// Adaptador de salida: implementa ClimaRepositorioPort sobre DynamoDB.
// El AWS SDK v3 viene incluido en el runtime Node.js de Lambda, por eso no se empaqueta en el bundle.

import { type DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { DiaClimaGuardado } from "../../domain/clima/tipos";
import type { ClimaRepositorioPort, ConfiguracionClima } from "../../ports/clima";
import { crearClienteDocumentos, escribirEnLotes } from "./dynamo";

export interface OpcionesRepositorioDynamo {
  tablaClima: string;
  tablaConfiguracion: string;
  cliente?: DynamoDBDocumentClient;
}

export function crearClimaRepositorioDynamo({
  tablaClima,
  tablaConfiguracion,
  cliente = crearClienteDocumentos(),
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
      await escribirEnLotes(cliente, tablaClima, items);
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
