#!/usr/bin/env bash
# Despliega el stack de Medianube (tablas DynamoDB + Lambda obtenerClima).
# Pensado para ejecutarse en AWS CloudShell (ya trae AWS CLI y credenciales).
#
# Uso (desde la carpeta backend/):
#   ./scripts/deploy.sh                          # modo dev, rol creado por el stack
#   ROL_LAMBDA=LabRole ./scripts/deploy.sh       # AWS Academy: reutiliza LabRole
#   MODO_AUTH=jwt ./scripts/deploy.sh            # exige token de Cognito en /clima
set -euo pipefail

cd "$(dirname "$0")/.."

REGION="${AWS_REGION:-us-east-2}"
ENTORNO="${ENTORNO:-dev}"
STACK="medianube-backend-${ENTORNO}"
MODO_AUTH="${MODO_AUTH:-dev}"
CUENTA="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="${BUCKET_ARTEFACTOS:-medianube-artefactos-${CUENTA}-${REGION}}"

ROL_ARN=""
if [[ -n "${ROL_LAMBDA:-}" ]]; then
  ROL_ARN="arn:aws:iam::${CUENTA}:role/${ROL_LAMBDA}"
fi

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
    RolLambdaArn="${ROL_ARN}"

aws cloudformation describe-stacks --stack-name "${STACK}" --region "${REGION}" \
  --query "Stacks[0].Outputs" --output table
