// Empaqueta cada Lambda en un único archivo ESM en dist/<nombre>/index.mjs.
// El AWS SDK v3 se marca como externo: ya viene incluido en el runtime de Lambda.
// Para sumar una Lambda nueva, agregar su composition root a LAMBDAS.

import { rmSync } from "node:fs";
import { build } from "esbuild";

const LAMBDAS = {
  obtenerClima: "src/composition/obtenerClima.ts",
};

rmSync("dist", { recursive: true, force: true });

for (const [nombre, entrada] of Object.entries(LAMBDAS)) {
  await build({
    entryPoints: [entrada],
    outfile: `dist/${nombre}/index.mjs`,
    bundle: true,
    platform: "node",
    target: "node22",
    format: "esm",
    external: ["@aws-sdk/*"],
    sourcemap: true,
    minify: false,
    logLevel: "info",
  });
}
