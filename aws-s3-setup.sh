#!/bin/bash

# ============================================================================
# AWS S3 Setup Script - Plataforma Confirming
# ============================================================================
# Este script crea y configura el bucket S3 para documentos
# Ejecutar: bash aws-s3-setup.sh
# ============================================================================

set -e  # Exit on error

# Configuración
# Bucket definitivo para documentos del proyecto.
BUCKET_NAME="n8nagentrobust"
REGION="us-east-1"

echo "========================================="
echo "AWS S3 Setup - Plataforma Confirming"
echo "========================================="
echo ""
echo "Bucket: $BUCKET_NAME"
echo "Region: $REGION"
echo ""

# Verificar que AWS CLI está instalado
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI no está instalado"
    echo "Instalar desde: https://aws.amazon.com/cli/"
    exit 1
fi

# Verificar credenciales
echo "Verificando credenciales de AWS..."
aws sts get-caller-identity > /dev/null 2>&1 || {
    echo "Error: No se encontraron credenciales de AWS configuradas"
    echo "Ejecuta: aws configure"
    exit 1
}
echo "✓ Credenciales verificadas"
echo ""

# Paso 1: Crear bucket
echo "Paso 1: Creando bucket S3..."
if aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
    echo "⚠ El bucket $BUCKET_NAME ya existe"
else
    aws s3api create-bucket \
        --bucket "$BUCKET_NAME" \
        --region "$REGION" \
        --create-bucket-configuration LocationConstraint="$REGION" 2>/dev/null || \
    aws s3api create-bucket \
        --bucket "$BUCKET_NAME" \
        --region "$REGION"
    echo "✓ Bucket creado: $BUCKET_NAME"
fi
echo ""

# Paso 2: Bloquear acceso público
echo "Paso 2: Bloqueando acceso público..."
aws s3api put-public-access-block \
    --bucket "$BUCKET_NAME" \
    --public-access-block-configuration \
        BlockPublicAcls=true,\
IgnorePublicAcls=true,\
BlockPublicPolicy=true,\
RestrictPublicBuckets=true
echo "✓ Acceso público bloqueado"
echo ""

# Paso 3: Habilitar versionado
echo "Paso 3: Habilitando versionado..."
aws s3api put-bucket-versioning \
    --bucket "$BUCKET_NAME" \
    --versioning-configuration Status=Enabled
echo "✓ Versionado habilitado"
echo ""

# Paso 4: Configurar encriptación
echo "Paso 4: Configurando encriptación (AES256)..."
aws s3api put-bucket-encryption \
    --bucket "$BUCKET_NAME" \
    --server-side-encryption-configuration '{
        "Rules": [{
            "ApplyServerSideEncryptionByDefault": {
                "SSEAlgorithm": "AES256"
            },
            "BucketKeyEnabled": true
        }]
    }'
echo "✓ Encriptación configurada"
echo ""

# Paso 5: Aplicar bucket policy
echo "Paso 5: Aplicando bucket policy..."
cat > /tmp/bucket-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyUnencryptedObjectUploads",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::${BUCKET_NAME}/*",
      "Condition": {
        "StringNotEquals": {
          "s3:x-amz-server-side-encryption": "AES256"
        }
      }
    }
  ]
}
EOF

aws s3api put-bucket-policy \
    --bucket "$BUCKET_NAME" \
    --policy file:///tmp/bucket-policy.json

rm /tmp/bucket-policy.json
echo "✓ Bucket policy aplicada"
echo ""

# Paso 6: Configurar CORS
echo "Paso 6: Configurando CORS..."
cat > /tmp/cors-config.json <<EOF
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "HEAD"],
      "AllowedOrigins": [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "https://confirming-onboarding.web.app",
        "https://confirming-onboarding.firebaseapp.com",
        "https://backoffice-confirming-741488896424.us-central1.run.app"
      ],
      "ExposeHeaders": ["ETag", "x-amz-request-id", "x-amz-id-2"],
      "MaxAgeSeconds": 3000
    }
  ]
}
EOF

aws s3api put-bucket-cors \
    --bucket "$BUCKET_NAME" \
    --cors-configuration file:///tmp/cors-config.json

rm /tmp/cors-config.json
echo "✓ CORS configurado"
echo ""

# Paso 7: Aplicar lifecycle policy
echo "Paso 7: Aplicando lifecycle policy..."
cat > /tmp/lifecycle-policy.json <<EOF
{
  "Rules": [
    {
      "Id": "TransitionToIA",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "CONFIRMING/pagadores/"
      },
      "Transitions": [
        {
          "Days": 90,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 365,
          "StorageClass": "GLACIER_IR"
        }
      ]
    },
    {
      "Id": "DeleteTempFiles",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "CONFIRMING/temp/"
      },
      "Expiration": {
        "Days": 1
      }
    },
    {
      "Id": "DeleteOldVersions",
      "Status": "Enabled",
      "NoncurrentVersionExpiration": {
        "NoncurrentDays": 30
      }
    }
  ]
}
EOF

aws s3api put-bucket-lifecycle-configuration \
    --bucket "$BUCKET_NAME" \
    --lifecycle-configuration file:///tmp/lifecycle-policy.json

rm /tmp/lifecycle-policy.json
echo "✓ Lifecycle policy aplicada"
echo ""

# Paso 8: Habilitar logging (opcional)
echo "Paso 8: Configurando logging (opcional)..."
read -p "¿Habilitar logging? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    LOGS_BUCKET="${BUCKET_NAME}-logs"

    # Crear bucket de logs
    aws s3api create-bucket \
        --bucket "$LOGS_BUCKET" \
        --region "$REGION" 2>/dev/null || true

    # Configurar logging
    aws s3api put-bucket-logging \
        --bucket "$BUCKET_NAME" \
        --bucket-logging-status '{
            "LoggingEnabled": {
                "TargetBucket": "'"$LOGS_BUCKET"'",
                "TargetPrefix": "s3-access-logs/"
            }
        }'
    echo "✓ Logging habilitado en $LOGS_BUCKET"
else
    echo "⊘ Logging no habilitado"
fi
echo ""

# Paso 9: Crear estructura de carpetas
echo "Paso 9: Creando estructura de carpetas..."
aws s3api put-object --bucket "$BUCKET_NAME" --key "pagadores/" --content-length 0
aws s3api put-object --bucket "$BUCKET_NAME" --key "proveedores/" --content-length 0
aws s3api put-object --bucket "$BUCKET_NAME" --key "facturas/" --content-length 0
aws s3api put-object --bucket "$BUCKET_NAME" --key "temp/" --content-length 0
echo "✓ Estructura de carpetas creada"
echo ""

# Resumen
echo "========================================="
echo "✓ Configuración completada exitosamente"
echo "========================================="
echo ""
echo "Bucket: s3://$BUCKET_NAME"
echo "Region: $REGION"
echo "URL: https://$BUCKET_NAME.s3.$REGION.amazonaws.com"
echo ""
echo "Características habilitadas:"
echo "  ✓ Acceso público bloqueado"
echo "  ✓ Versionado habilitado"
echo "  ✓ Encriptación AES256"
echo "  ✓ Bucket policy aplicada"
echo "  ✓ CORS configurado"
echo "  ✓ Lifecycle policies"
echo ""
echo "Próximos pasos:"
echo "1. Crear IAM role 'ConfirmingEdgeFunctionRole' en AWS Console"
echo "2. Adjuntar política para generar presigned URLs"
echo "3. Configurar credenciales en Supabase Edge Functions"
echo ""
