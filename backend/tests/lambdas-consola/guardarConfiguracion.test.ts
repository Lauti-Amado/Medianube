import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { armarActualizacion, handler, leerCambios } from "../../lambdas-consola/guardarConfiguracion/index.mjs";

type Update = {
  Key: { usuarioID: string };
  UpdateExpression: string;
  ExpressionAttributeNames: Record<string, string>;
  ExpressionAttributeValues: Record<string, unknown>;
};

const sendOriginal = DynamoDBDocumentClient.prototype.send;
afterEach(() => {
  DynamoDBDocumentClient.prototype.send = sendOriginal;
});

/** Simula la tabla: aplica el SET sobre el ítem guardado, sin borrar los demás campos. */
function simularTabla(inicial: Record<string, Record<string, unknown>> = {}) {
  const tabla = structuredClone(inicial);
  const enviados: Update[] = [];
  DynamoDBDocumentClient.prototype.send = (async (comando: { input: Update }) => {
    const q = comando.input;
    enviados.push(q);
    const item = (tabla[q.Key.usuarioID] ??= { usuarioID: q.Key.usuarioID });
    for (const asignacion of q.UpdateExpression.replace(/^SET /, "").split(/, (?![^(]*\))/)) {
      const [nombre, expr] = asignacion.split(" = ");
      const campo = q.ExpressionAttributeNames[nombre!]!;
      const noExiste = /^if_not_exists\(#\w+, (:\w+)\)$/.exec(expr!);
      if (noExiste) {
        if (item[campo] === undefined) item[campo] = q.ExpressionAttributeValues[noExiste[1]!];
      } else {
        item[campo] = q.ExpressionAttributeValues[expr!];
      }
    }
    return { Attributes: structuredClone(item) };
  }) as unknown as typeof sendOriginal;
  return { tabla, enviados };
}

const evento = (body: unknown, sub: string | null = "u1") => ({
  requestContext: { http: { method: "PUT" }, ...(sub && { authorizer: { jwt: { claims: { sub } } } }) },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

async function guardar(body: unknown, sub: string | null = "u1") {
  const res = await handler(evento(body, sub));
  return { status: res.statusCode, body: JSON.parse(res.body) };
}

const ONBOARDING = {
  nombreNegocio: "  Panadería Central ",
  tipoLocal: "panaderia",
  ciudad: "La Plata",
  sucursales: 2,
  margenes: { panaderia: 40, pasteleria: 45, bebidas: 60 },
  ubicacion: { lat: -34.92, lon: -57.95, ciudad: "La Plata" },
};

describe("guardarConfiguracion", () => {
  it("guarda los datos del onboarding con la ubicación en el formato del clima", async () => {
    const { tabla } = simularTabla();
    const { status, body } = await guardar(ONBOARDING);
    assert.equal(status, 200);
    assert.equal(body.configuracion.nombreNegocio, "Panadería Central");
    assert.deepEqual(tabla.u1!.ubicacion, { lat: -34.92, lon: -57.95, ciudad: "La Plata" });
    assert.deepEqual(tabla.u1!.margenes, { panaderia: 40, pasteleria: 45, bebidas: 60 });
    assert.ok(tabla.u1!.creadoEn);
  });

  it("no borra los campos que no vienen en el body", async () => {
    const { tabla } = simularTabla({
      u1: { usuarioID: "u1", ubicacion: { lat: -34.6, lon: -58.4, ciudad: "CABA" }, notificaciones: { precios: true }, creadoEn: "2026-11-01" },
    });
    await guardar({ nombreNegocio: "Nuevo nombre", rubro: "panadería" });
    assert.equal(tabla.u1!.nombreNegocio, "Nuevo nombre");
    assert.deepEqual(tabla.u1!.ubicacion, { lat: -34.6, lon: -58.4, ciudad: "CABA" });
    assert.deepEqual(tabla.u1!.notificaciones, { precios: true });
    assert.equal(tabla.u1!.creadoEn, "2026-11-01");
  });

  it("guarda cada configuración con el usuario del token, nunca con uno del body", async () => {
    const { enviados } = simularTabla();
    await guardar({ ...ONBOARDING, usuarioID: "otro" }, "u1");
    assert.equal(enviados[0]!.Key.usuarioID, "u1");
    assert.ok(!Object.values(enviados[0]!.ExpressionAttributeNames).includes("usuarioID"));
  });

  it("ignora campos desconocidos", () => {
    assert.deepEqual(leerCambios({ ciudad: "Rosario", admin: true }), { ciudad: "Rosario" });
  });

  it("acepta números que llegan como texto", () => {
    assert.deepEqual(leerCambios({ margenes: { panaderia: "40", pasteleria: "45.5", bebidas: 60 } }).margenes, {
      panaderia: 40,
      pasteleria: 45.5,
      bebidas: 60,
    });
  });

  it("arma un SET por campo sin pisar creadoEn", () => {
    const upd = armarActualizacion("u1", { ciudad: "Rosario" }, "2026-11-24T00:00:00.000Z");
    assert.equal(upd.UpdateExpression, "SET #actualizadoEn = :ahora, #creadoEn = if_not_exists(#creadoEn, :ahora), #ciudad = :ciudad");
  });

  it("responde 401 sin usuario del token", async () => {
    simularTabla();
    assert.equal((await guardar(ONBOARDING, null)).status, 401);
  });

  it("responde 400 con datos inválidos sin escribir en la tabla", async () => {
    const { enviados } = simularTabla();
    const invalidos: unknown[] = [
      "{no es json",
      [],
      {},
      { nombreNegocio: "   " },
      { sucursales: 0 },
      { sucursales: 1.5 },
      { margenes: { panaderia: 40, pasteleria: 45 } },
      { margenes: { panaderia: 120, pasteleria: 45, bebidas: 60 } },
      { ubicacion: { lat: 95, lon: 0 } },
      { ubicacion: { latitud: -34.9, longitud: -57.9 } },
    ];
    for (const body of invalidos) {
      assert.equal((await guardar(body)).status, 400, JSON.stringify(body));
    }
    assert.equal(enviados.length, 0);
  });
});
