import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ErrorApi, MENSAJE_SESION_VENCIDA, SesionVencida, mensajeDeError } from "./errores";

describe("mensajeDeError", () => {
  it("pide volver a iniciar sesión sin token o con 401/403", () => {
    assert.equal(mensajeDeError(new SesionVencida(), "cargar tus compras"), MENSAJE_SESION_VENCIDA);
    assert.equal(mensajeDeError(new ErrorApi(401), "cargar tus compras"), MENSAJE_SESION_VENCIDA);
    assert.equal(mensajeDeError(new ErrorApi(403), "cargar tus compras"), MENSAJE_SESION_VENCIDA);
  });

  it("sugiere revisar la conexión cuando fetch no llega al servidor", () => {
    assert.equal(
      mensajeDeError(new TypeError("Failed to fetch"), "cargar tus compras"),
      "No pudimos cargar tus compras. Revisá tu conexión y probá de nuevo."
    );
  });

  it("usa un mensaje genérico para errores del servidor u otros", () => {
    const esperado = "No pudimos guardar los cambios. Probá de nuevo en unos minutos.";
    assert.equal(mensajeDeError(new ErrorApi(500), "guardar los cambios"), esperado);
    assert.equal(mensajeDeError(new Error("x"), "guardar los cambios"), esperado);
    assert.equal(mensajeDeError("raro", "guardar los cambios"), esperado);
  });
});
