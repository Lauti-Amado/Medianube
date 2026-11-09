#!/usr/bin/env bash
# Despliega el stack de Medianube (tablas DynamoDB + Lambdas obtenerClima, sugerirPrecios y
# predecirDemanda, con sus reglas de EventBridge).
# Pensado para ejecutarse en AWS CloudShell (ya trae AWS CLI y credenciales).
#
# Uso (desde la carpeta backend/):
#   ./scripts/deploy.sh                          # modo dev, rol creado por el stack
#   ROL_LAMBDA=LabRole ./scripts/deploy.sh       # AWS Academy: reutiliza LabRole
#   MODO_AUTH=jwt ./scripts/deploy.sh            # exige token de Cognito en /clima y /precios/sugerir
#   CLAUDE_API_KEY=sk-ant-... ./scripts/deploy.sh # API key del motor de precios (si no se pasa,
#                                                # se conserva la del despliegue anterior)
#   CRON_PREDICCION="cron(0 9 * * ? *)" ./scripts/deploy.sh  # horario (UTC) de la predicción de demanda
#                                                # (default 05:30 ART = cron(30 8 * * ? *))
set -euo pipefail

cd "$(dirname "$0")/.."

REGION="${AWS_REGION:-us-east-2}"
ENTORNO="${ENTORNO:-dev}"
STACK="medianube-backend-${ENTORNO}"
MODO_AUTH="${MODO_AUTH:-dev}"
CUENTA="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="${BUCKET_ARTEFACTOS:-medianube-artefactos-${CUENTA}-${REGION}}"

ROL_ARN=""
PARAMETROS_EXTRA=()
if [[ -n "${CLAUDE_API_KEY:-}" ]]; then
  PARAMETROS_EXTRA+=("ClaudeApiKey=${CLAUDE_API_KEY}")
fi
if [[ -n "${MODELO_LLM:-}" ]]; then
  PARAMETROS_EXTRA+=("ModeloLlm=${MODELO_LLM}")
fi
if [[ -n "${CRON_PREDICCION:-}" ]]; then
  PARAMETROS_EXTRA+=("CronPrediccion=${CRON_PREDICCION}")
fi
if [[ -n "${ROL_LAMBDA:-}" ]]; then
  ROL_ARN="arn:aws:iam::${CUENTA}:role/${ROL_LAMBDA}"
fi

# ── Chequeo previo: no chocar con tablas creadas a mano ─────────────────────
# Si una tabla del stack ya existe pero el stack no la administra, CloudFormation falla con
# "already exists" a mitad del deploy. Se corta antes, sin borrar nada: la decisión es del equipo.
# Mantener esta lista igual a los TableName de infra/template.yaml.
TABLAS_DEL_STACK=(Medianube-Facturas Medianube-Productos Medianube-Ventas Medianube-Predicciones Medianube-Clima)

echo "▶ Chequeo previo del stack ${STACK}"
ESTADO_STACK="$(aws cloudformation describe-stacks --stack-name "${STACK}" --region "${REGION}" \
  --query "Stacks[0].StackStatus" --output text 2>/dev/null || echo "NO_EXISTE")"

if [[ "${ESTADO_STACK}" == "ROLLBACK_COMPLETE" ]]; then
  cat >&2 <<EOF
✖ El stack ${STACK} quedó en ROLLBACK_COMPLETE (falló su primera creación) y no se puede actualizar.
  1. Revisá el motivo:  aws cloudformation describe-stack-events --stack-name ${STACK} --region ${REGION} \\
                          --query "StackEvents[?ResourceStatus=='CREATE_FAILED'].[LogicalResourceId,ResourceStatusReason]" --output table
  2. Borrá el stack:    aws cloudformation delete-stack --stack-name ${STACK} --region ${REGION}
     (las tablas de negocio tienen DeletionPolicy Retain: si se llegaron a crear, quedan y este chequeo
     las va a marcar en el próximo intento)
  3. Volvé a correr este script.
EOF
  exit 1
fi

TABLAS_ADMINISTRADAS=""
if [[ "${ESTADO_STACK}" != "NO_EXISTE" ]]; then
  TABLAS_ADMINISTRADAS="$(aws cloudformation list-stack-resources --stack-name "${STACK}" --region "${REGION}" \
    --query "StackResourceSummaries[?ResourceType=='AWS::DynamoDB::Table'].PhysicalResourceId" --output text)"
fi

CONFLICTOS=()
for TABLA in "${TABLAS_DEL_STACK[@]}"; do
  if [[ " ${TABLAS_ADMINISTRADAS} " == *[[:space:]]"${TABLA}"[[:space:]]* ]]; then
    continue # ya es del stack
  fi
  if ITEMS="$(aws dynamodb describe-table --table-name "${TABLA}" --region "${REGION}" \
      --query "Table.ItemCount" --output text 2>/dev/null)"; then
    CONFLICTOS+=("${TABLA} (~${ITEMS} ítems)")
  fi
done

if [[ ${#CONFLICTOS[@]} -gt 0 ]]; then
  {
    echo "✖ Estas tablas ya existen en la cuenta pero no las administra el stack ${STACK}:"
    printf '    - %s\n' "${CONFLICTOS[@]}"
    cat <<EOF
  CloudFormation fallaría con "already exists". No se borró nada. Opciones, tabla por tabla:
  a) Si está vacía o es de prueba y nadie del equipo la usa: borrala y volvé a correr el script.
       aws dynamodb delete-table --table-name <tabla> --region ${REGION}
  b) Si tiene datos de un compañero: importala al stack en lugar de borrarla.
       https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/resource-import-existing-stack.html
  (ItemCount es aproximado: DynamoDB lo actualiza cada ~6 horas.)
EOF
  } >&2
  exit 1
fi
echo "  ✔ Sin conflictos de tablas (stack: ${ESTADO_STACK})"

echo "▶ Dependencias, tipos y tests"
npm ci
npm run check

echo "▶ Compilando Lambdas (esbuild → dist/)"
npm run build

echo "▶ Bucket de artefactos: ${BUCKET}"
if ! aws s3api head-bucket --bucket "${BUCKET}" 2>/dev/null; then
  aws s3 mb "s3://${BUCKET}" --region "${REGION}"
  aws s3api put-public-access-block --bucket "${BUCKET}" \
    --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
fi

mkdir -p .aws-build
echo "▶ Empaquetando"
aws cloudformation package \
  --template-file infra/template.yaml \
  --s3-bucket "${BUCKET}" \
  --s3-prefix "${STACK}" \
  --output-template-file .aws-build/packaged.yaml \
  --region "${REGION}"

echo "▶ Desplegando ${STACK} (modo auth: ${MODO_AUTH})"
aws cloudformation deploy \
  --template-file .aws-build/packaged.yaml \
  --stack-name "${STACK}" \
  --region "${REGION}" \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
    Entorno="${ENTORNO}" \
    ModoAutenticacion="${MODO_AUTH}" \
    RolLambdaArn="${ROL_ARN}" \
    ${PARAMETROS_EXTRA[@]+"${PARAMETROS_EXTRA[@]}"}

aws cloudformation describe-stacks --stack-name "${STACK}" --region "${REGION}" \
  --query "Stacks[0].Outputs" --output table
