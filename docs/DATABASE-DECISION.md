# ADR: Base de datos de Medianube (DynamoDB vs RDS)

**Estado:** Aceptada · **Fecha:** 18/10/2026 · **Rama:** `feat/setupBD`

## Contexto

El one-pager dejaba abierta la elección entre DynamoDB y Amazon RDS. Ya existía una tabla
DynamoDB (`Medianube-Configuracion`) y la convención de PK `usuarioID` del README. Además,
había que sumar una Lambda que consume una API de clima externa (internet público).

## Decisión

Usar **Amazon DynamoDB On-Demand** para toda la persistencia, con diseño **multi-tabla** y
**clave compuesta** `usuarioID` (HASH) + clave de ordenamiento (RANGE) por entidad.

## Alternativa descartada: RDS (PostgreSQL / MySQL Free Tier)

| Criterio | DynamoDB | RDS |
|---|---|---|
| Red | Endpoint público con IAM, la Lambda sale a internet sin VPC | La Lambda tiene que estar en la VPC → para llamar a Open-Meteo hace falta **NAT Gateway (~USD 32/mes)** |
| Costo en reposo | USD 0 (On-Demand) | La instancia cobra 24/7 fuera del Free Tier |
| Conexiones desde Lambda | HTTP sin estado | Pool de conexiones / RDS Proxy |
| Coherencia | Igual a la decisión Serverless (09/09) y a la tabla existente | Rompe el escalado a cero |
| Trade-off asumido | Sin JOINs ni consultas ad-hoc → el modelo se diseña según los patrones de acceso | — |

## Modelo de datos

| Tabla | PK | SK | Notas |
|---|---|---|---|
| `Medianube-Configuracion` | `usuarioID` | — | Existente, fuera del stack. Nuevo atributo `ubicacion {ciudad, lat, lon}` |
| `Medianube-Facturas` | `usuarioID` | `facturaID` = `<ISO-fecha>#<uuid>` | PITR activado |
| `Medianube-Productos` | `usuarioID` | `productoID` | — |
| `Medianube-Ventas` | `usuarioID` | `fechaProducto` = `<YYYY-MM-DD>#<productoID>` | PITR activado |
| `Medianube-Predicciones` | `usuarioID` | `fechaProducto` = `<YYYY-MM-DD>#<productoID>` | TTL `expiraEn` |
| `Medianube-Clima` | `usuarioID` | `fecha` = `YYYY-MM-DD` | TTL `expiraEn` (14 días), cache regenerable |

- **Patrón de acceso principal:** `Query` por `usuarioID` con rango de fechas sobre la SK
  (`BETWEEN` / `begins_with`). No se usan `Scan` en caminos de usuario.
- **Clima por usuario (y no por ubicación):** se respeta la convención `usuarioID` aunque se
  dupliquen pronósticos de usuarios de la misma ciudad. A esta escala el costo es despreciable,
  y así se cruzan clima, ventas y predicciones con la misma clave (RAG).
- Las tablas de negocio usan `DeletionPolicy: Retain`: borrar el stack no borra los datos.

## Consecuencias

- Cuando la IA necesite consultas analíticas que DynamoDB no resuelva bien, se van a evaluar
  exportaciones a S3 + Athena, sin migrar el almacenamiento transaccional.
- Las Lambdas que escriben en `Medianube-Configuracion` tienen que usar `UpdateItem` (no `PutItem`)
  para no borrar atributos como `ubicacion`.
