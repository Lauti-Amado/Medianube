# Lambdas creadas en la consola

Código de las funciones que el equipo creó a mano en la consola de AWS (no salen de `src/` ni de `template.yaml`).
Cada carpeta tiene el `index.mjs` tal como corre en AWS; se despliega comprimiendo ese archivo en un `.zip` y
subiéndolo en Lambda → Código → Cargar desde → archivo .zip.
`scripts/deploy.sh` **no** las incluye: no correrlo, porque pisaría estas funciones (ver `docs/DESPLIEGUE-MANUAL.md`).

## `listarGastos` (GET /compras)

Historial de facturas del usuario logueado (`sub` del token de Cognito). Con `?limite=N` pagina con `Limit` y
`ExclusiveStartKey` de DynamoDB y devuelve `{ gastos, count, siguiente, resumen }`; sin `limite` devuelve todo,
como antes, porque el Dashboard y el polling de la subida de facturas todavía lo usan así.

Antes de subir el `.zip` hay que preparar la tabla y el rol, en este orden:

1. **Índice en `Gastos`:** DynamoDB → Tablas → `Gastos` → Índices → Crear índice. Clave de partición
   `usuarioID` (String), clave de ordenación `fecha` (String), nombre `usuarioID-fecha-index`, proyección "Todos".
   Esperar a que quede **Activo**. Los gastos sin `fecha` no entran al índice y dejan de aparecer en el historial.
   Antes, revisar que ningún gasto tenga `fecha` con otro tipo que String (por ejemplo `null`): DynamoDB rechaza
   escribir un ítem cuya clave de índice tenga el tipo equivocado, así que `procesarFactura` fallaría con esas facturas.
2. **Permiso:** al rol de la Lambda agregarle `dynamodb:Query` sobre
   `arn:aws:dynamodb:us-east-2:<cuenta>:table/Gastos/index/usuarioID-fecha-index`.
3. **Variables de entorno (opcionales):** `TABLA_GASTOS` (`Gastos`), `INDICE_USUARIO_FECHA`
   (`usuarioID-fecha-index`), `ZONA_HORARIA` (`America/Argentina/Buenos_Aires`), `CORS_ORIGIN` (`*`).
4. **Ruta:** `GET /compras` tiene que seguir con el authorizer JWT de Cognito; sin `sub` la Lambda responde 401.

Recién ahí subir el `.zip` con `index.mjs`. Si se sube antes de que el índice esté activo, `/compras` responde 500.
Tests: `npm test` en `backend/` (`tests/lambdas-consola/listarGastos.test.ts`).
