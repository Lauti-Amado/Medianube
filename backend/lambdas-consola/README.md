# Lambdas creadas en la consola

Código de las funciones que el equipo creó a mano en la consola de AWS (no salen de `src/` ni de `template.yaml`).
Cada carpeta tiene el `index.mjs` tal como corre en AWS; se despliega comprimiendo ese archivo en un `.zip` y
subiéndolo en Lambda → Código → Cargar desde → archivo .zip.
`scripts/deploy.sh` **no** las incluye: no correrlo, porque pisaría estas funciones (ver `docs/DESPLIEGUE-MANUAL.md`).
