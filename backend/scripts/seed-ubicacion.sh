#!/usr/bin/env bash
# Agrega (o actualiza) la ubicación del negocio en Medianube-Configuracion sin pisar el resto de atributos.
# Mientras el frontend no tenga el campo de ubicación, sirve para probar /clima con datos reales.
#
# Uso: ./scripts/seed-ubicacion.sh <usuarioID> <ciudad> <lat> <lon>
# Ej.: ./scripts/seed-ubicacion.sh user_test_123 "La Plata" -34.9214 -57.9545
set -euo pipefail

if [[ $# -ne 4 ]]; then
  echo "Uso: $0 <usuarioID> <ciudad> <lat> <lon>" >&2
  exit 1
fi

USUARIO="$1"; CIUDAD="$2"; LAT="$3"; LON="$4"
REGION="${AWS_REGION:-us-east-2}"
TABLA="${TABLA_CONFIGURACION:-Medianube-Configuracion}"

aws dynamodb update-item \
  --region "${REGION}" \
  --table-name "${TABLA}" \
  --key "{\"usuarioID\": {\"S\": \"${USUARIO}\"}}" \
  --update-expression "SET ubicacion = :u" \
  --expression-attribute-values "{\":u\": {\"M\": {
      \"ciudad\": {\"S\": \"${CIUDAD}\"},
      \"lat\": {\"N\": \"${LAT}\"},
      \"lon\": {\"N\": \"${LON}\"}
    }}}" \
  --return-values UPDATED_NEW
