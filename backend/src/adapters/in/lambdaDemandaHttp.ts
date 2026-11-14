// backend/src/adapters/in/lambdaDemandaHttp.ts
// Adaptador de entrada de GET /demanda: lee las predicciones guardadas por predecirDemanda.
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { fechaLocal } from "../../domain/clima/reglas";
import { crearClienteDocumentos } from "../out/dynamo";
import { type ContextoLambda, type EventoHttp, resolverUsuarioID, respuesta, respuestaError } from "./http";

const cliente = crearClienteDocumentos();
const TABLA = process.env.TABLA_PREDICCIONES ?? "Medianube-Predicciones";
const ZONA = process.env.ZONA_HORARIA ?? "America/Argentina/Buenos_Aires";
const PERMITIR_QUERY = process.env.PERMITIR_USUARIO_QUERY === "true";

type Item = Record<string, unknown>;

export const handler = async (event: EventoHttp, contexto?: ContextoLambda) => {
  const usuarioID = resolverUsuarioID(event, { permitirUsuarioQuery: PERMITIR_QUERY });
  if (!usuarioID) return respuesta(401, { error: "No autenticado." });

  try {
    const hoy = fechaLocal(new Date(), ZONA);
    const items: Item[] = [];
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const pagina = await cliente.send(
        new QueryCommand({
          TableName: TABLA,
          KeyConditionExpression: "#u = :u AND #sk >= :hoy",
          ExpressionAttributeNames: { "#u": "usuarioID", "#sk": "fechaProducto" },
          ExpressionAttributeValues: { ":u": usuarioID, ":hoy": hoy },
          ExclusiveStartKey,
        })
      );
      items.push(...((pagina.Items ?? []) as Item[]));
      ExclusiveStartKey = pagina.LastEvaluatedKey;
    } while (ExclusiveStartKey);

    const produccion = items.map((i) => ({
      productoID: String(i.productoID ?? ""),
      nombre: String(i.nombre ?? i.productoID ?? ""),
      cantidad: Number(i.cantidad ?? 0),
      confianza: i.confianza ?? null,
      fecha: i.fecha ?? null,
    }));

    // Precisión global: promedio de la precisión (backtest) de cada producto, entre 0 y 1.
    const porProducto = new Map<string, number>();
    for (const i of items) {
      if (typeof i.precisionPct === "number") porProducto.set(String(i.productoID), i.precisionPct);
    }
    const valores = [...porProducto.values()];
    const precision = valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null;

    return respuesta(200, { produccion, precision, origen: "Modelo estadístico (DynamoDB)" });
  } catch (error) {
    return respuestaError(error, { requestId: contexto?.awsRequestId, usuarioID, operacion: "leerDemanda", log: console });
  }
};