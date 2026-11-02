// Utilidades compartidas por los adaptadores de DynamoDB.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchWriteCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const LOTE_MAXIMO = 25; // límite de BatchWriteItem
const REINTENTOS = 3;

const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function crearClienteDocumentos(): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
}

type Pendientes = Record<string, Array<{ PutRequest: { Item: Record<string, unknown> } }>>;

/**
 * Escribe con BatchWriteItem en lotes de 25. DynamoDB puede devolver ítems sin procesar por
 * throttling: se reintentan con backoff exponencial y, si no entran, se lanza un error.
 */
export async function escribirEnLotes(
  cliente: DynamoDBDocumentClient,
  tabla: string,
  items: object[],
  { reintentos = REINTENTOS, esperaBaseMs = 100 } = {}
): Promise<void> {
  for (let i = 0; i < items.length; i += LOTE_MAXIMO) {
    let pendientes: Pendientes | undefined = {
      [tabla]: items
        .slice(i, i + LOTE_MAXIMO)
        .map((Item) => ({ PutRequest: { Item: Item as Record<string, unknown> } })),
    };
    for (let intento = 0; pendientes && Object.keys(pendientes).length > 0; intento++) {
      if (intento >= reintentos) throw new Error(`No se pudieron escribir todos los ítems en ${tabla}.`);
      if (intento > 0) await esperar(esperaBaseMs * 2 ** intento);
      const { UnprocessedItems } = await cliente.send(new BatchWriteCommand({ RequestItems: pendientes }));
      pendientes = UnprocessedItems as Pendientes | undefined;
    }
  }
}
