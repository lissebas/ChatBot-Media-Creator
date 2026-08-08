#!/usr/bin/env bash
# Despliegue de ChatBot Creator en AWS: crea/actualiza la infraestructura,
# compila la app con la configuración de Cognito y la sube a S3 + CloudFront.
#
#   ./infra/deploy.sh              → todo (infra + build + subida)
#   ./infra/deploy.sh --solo-app   → salta CloudFormation (cambios de código)
set -euo pipefail

PROYECTO="chatbot-creator"
STACK="$PROYECTO"
REGION="${AWS_REGION:-us-west-2}"
TAG="Project=ChatBotMediaCreator"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Perfil personal (el que tiene la cuenta de este proyecto).
export AWS_CONFIG_FILE="${AWS_CONFIG_FILE:-$HOME/.aws/Personal/config}"
export AWS_SHARED_CREDENTIALS_FILE="${AWS_SHARED_CREDENTIALS_FILE:-$HOME/.aws/Personal/credentials}"
export AWS_REGION="$REGION"

salida() { aws cloudformation describe-stacks --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }

if [[ "${1:-}" != "--solo-app" ]]; then
  echo "▸ Infraestructura (${REGION})…"
  aws cloudformation deploy \
    --stack-name "$STACK" \
    --template-file "$RAIZ/infra/chatbot-creator.yaml" \
    --tags "$TAG" \
    --no-fail-on-empty-changeset
fi

BUCKET="$(salida Bucket)"
DIST="$(salida DistribucionId)"
URL="$(salida Url)"
COGNITO_DOMINIO="$(salida CognitoDominio)"
COGNITO_CLIENTE="$(salida CognitoClienteId)"

echo "▸ Compilando (Vite en Docker)…"
docker run --rm \
  -v "$RAIZ":/app -v chatbotcreator_studio_node_modules:/app/node_modules -w /app \
  -e VITE_COGNITO_DOMINIO="$COGNITO_DOMINIO" \
  -e VITE_COGNITO_CLIENTE="$COGNITO_CLIENTE" \
  -e VITE_URL_APP="$URL/" \
  node:20-alpine ./node_modules/.bin/vite build

echo "▸ Subiendo a s3://${BUCKET}…"
# Los assets llevan hash en el nombre: se cachean para siempre.
aws s3 sync "$RAIZ/dist" "s3://$BUCKET" --delete \
  --exclude index.html --cache-control "public,max-age=31536000,immutable"
# El index.html cambia en cada despliegue: nunca se cachea.
aws s3 cp "$RAIZ/dist/index.html" "s3://$BUCKET/index.html" \
  --cache-control "no-cache,no-store,must-revalidate" --content-type "text/html; charset=utf-8"

echo "▸ Invalidando la caché de CloudFront…"
aws cloudfront create-invalidation --distribution-id "$DIST" --paths "/*" \
  --query 'Invalidation.Id' --output text

rm -rf "$RAIZ/dist"
echo
echo "✅ Listo: $URL"
echo "   Login:  $COGNITO_DOMINIO"
echo "   Usuarios nuevos:  ./infra/usuario.sh correo@ejemplo.com"
