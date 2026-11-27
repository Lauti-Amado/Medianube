import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { API_BASE, CDN_BASE, apiUrl, cdnUrl, sinCache } from "./api";

describe("cdnUrl", () => {
  it("arma las lecturas cacheables sobre CloudFront", () => {
    assert.equal(CDN_BASE, "https://d2nm15i6i0na2r.cloudfront.net");
    assert.equal(cdnUrl("/clima?usuarioID=u"), "https://d2nm15i6i0na2r.cloudfront.net/clima?usuarioID=u");
    assert.equal(cdnUrl("demanda"), "https://d2nm15i6i0na2r.cloudfront.net/demanda");
  });

  it("el resto de las rutas sigue yendo directo a la API", () => {
    assert.equal(apiUrl("/compras"), `${API_BASE}/compras`);
    assert.notEqual(API_BASE, CDN_BASE);
  });
});

describe("sinCache", () => {
  it("agrega el parámetro _ para pedir la versión fresca", () => {
    assert.equal(sinCache("https://x/demanda?usuarioID=u", 123), "https://x/demanda?usuarioID=u&_=123");
    assert.equal(sinCache("https://x/clima", 456), "https://x/clima?_=456");
  });
});
