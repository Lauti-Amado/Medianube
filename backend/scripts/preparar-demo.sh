#!/usr/bin/env bash
# Deja un usuario de prueba listo para probar clima, precios y sugerencia de producción:
# ubicación, productos con receta, facturas, 8 semanas de ventas, pronóstico del clima y predicción
# de demanda. Correr después de ./scripts/deploy.sh, desde AWS CloudShell.
# Es idempotente: se puede volver a correr y pisa los mismos datos de demo.
#
# Uso (desde la carpeta backend/):
#   ./scripts/preparar-demo.sh                                  # user_test_123 en La Plata
#   ./scripts/preparar-demo.sh <usuarioID>                      # otro usuario, en La Plata
#   ./scripts/preparar-demo.sh <usuarioID> <ciudad> <lat> <lon> # otro usuario y ubicación
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ $# -ne 0 && $# -ne 1 && $# -ne 4 ]]; then
  echo "Uso: $0 [usuarioID] [<ciudad> <lat> <lon>]" >&2
  exit 1
fi

USUARIO="${1:-user_test_123}"
CIUDAD="${2:-La Plata}"
LAT="${3:--34.9214}"
LON="${4:--57.9545}"
REGION="${AWS_REGION:-us-east-2}"
ENTORNO="${ENTORNO:-dev}"
export AWS_REGION="${REGION}"

SALIDA="$(mktemp -d)"
trap 'rm -rf "${SALIDA}"' EXIT

RESULTADOS=()
FALLOS=0

# Corre un paso, muestra su salida y registra si salió bien, sin cortar el resto.
paso() {
  local nombre="$1"; shift
  echo "▶ ${nombre}"
  if "$@"; then
    RESULTADOS+=("✔ ${nombre}")
  else
    RESULTADOS+=("✖ ${nombre}")
    FALLOS=$((FALLOS + 1))
  fi
}

# Invoca una Lambda y falla si la función lanzó un error (FunctionError), no solo si falló la llamada.
invocar() {
  local funcion="$1" payload="$2" archivo="${SALIDA}/$1.json" error
  error="$(aws lambda invoke --function-name "${funcion}" --region "${REGION}" \
    --cli-binary-format raw-in-base64-out --payload "${payload}" \
    --query FunctionError --output text "${archivo}")" || return 1
  echo "  respuesta: $(head -c 400 "${archivo}")"
  [[ "${error}" == "None" || -z "${error}" ]]
}

contar() {
  local tabla="$1" minimo="$2" total
  total="$(aws dynamodb query --table-name "${tabla}" --region "${REGION}" \
    --key-condition-expression "usuarioID = :u" \
    --expression-attribute-values "{\":u\":{\"S\":\"${USUARIO}\"}}" \
    --select COUNT --query Count --output text)" || return 1
  echo "  ${tabla}: ${total} ítems para ${USUARIO}"
  [[ "${total}" -ge "${minimo}" ]]
}

if [[ ! -d node_modules/@aws-sdk/lib-dynamodb ]]; then
  echo "▶ Instalando dependencias (npm ci) para los seeds"
  npm ci --silent
fi

echo "Preparando datos de demo para ${USUARIO} (${CIUDAD}) en ${REGION}, entorno ${ENTORNO}"
echo

paso "Ubicación en Medianube-Configuracion" ./scripts/seed-ubicacion.sh "${USUARIO}" "${CIUDAD}" "${LAT}" "${LON}"
paso "Productos con receta y facturas" node scripts/seed-precios.mjs "${USUARIO}"
paso "8 semanas de ventas" node scripts/seed-ventas.mjs "${USUARIO}"
# El refresco programado recorre todos los usuarios con ubicación; así no hay que esperar a las 05:00.
paso "Pronóstico del clima (obtenerClima)" invocar "obtenerClima-${ENTORNO}" "$(cat events/refresco-programado.json)"
paso "Predicción de demanda (predecirDemanda)" invocar "predecirDemanda-${ENTORNO}" "{\"usuarioID\":\"${USUARIO}\"}"
paso "Verificar Medianube-Clima (7 días)" contar Medianube-Clima 7
paso "Verificar Medianube-Predicciones" contar Medianube-Predicciones 1

echo
echo "Resumen:"
printf '  %s\n' "${RESULTADOS[@]}"
if [[ ${FALLOS} -gt 0 ]]; then
  echo "✖ ${FALLOS} paso(s) fallaron. Revisá la salida de arriba y los logs en CloudWatch (/aws/lambda/<función>-${ENTORNO})." >&2
  exit 1
fi
echo "✔ Listo. Probá: curl \"https://${API_ID:-1i2vqeifsi}.execute-api.${REGION}.amazonaws.com/clima?usuarioID=${USUARIO}\""
echo "  Guía para consumir clima y predicciones desde otra Lambda: docs/INTEGRACION-CLIMA.md"
