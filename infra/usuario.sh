#!/usr/bin/env bash
# Crea un usuario en el Cognito de ChatBot Creator (no hay auto-registro).
#
#   ./infra/usuario.sh correo@ejemplo.com
#
# Cognito envía la contraseña temporal por correo; al entrar la primera vez el
# Hosted UI pide cambiarla.
set -euo pipefail

CORREO="${1:-}"
[[ -z "$CORREO" ]] && { echo "Uso: $0 correo@ejemplo.com"; exit 1; }

export AWS_CONFIG_FILE="${AWS_CONFIG_FILE:-$HOME/.aws/Personal/config}"
export AWS_SHARED_CREDENTIALS_FILE="${AWS_SHARED_CREDENTIALS_FILE:-$HOME/.aws/Personal/credentials}"
export AWS_REGION="${AWS_REGION:-us-west-2}"

POOL="$(aws cloudformation describe-stacks --stack-name chatbot-creator \
  --query "Stacks[0].Outputs[?OutputKey=='CognitoUserPoolId'].OutputValue" --output text)"

aws cognito-idp admin-create-user \
  --user-pool-id "$POOL" \
  --username "$CORREO" \
  --user-attributes Name=email,Value="$CORREO" Name=email_verified,Value=true \
  --desired-delivery-mediums EMAIL \
  --query 'User.UserStatus' --output text

echo "✅ Usuario creado. Revisa el correo para la contraseña temporal."
