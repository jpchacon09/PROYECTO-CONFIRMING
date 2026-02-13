// ============================================================================
// Edge Function: generar-url-subida
// ============================================================================
// Genera presigned URL para subir documentos a S3 y crea registro en DB
//
// Flujo:
// 1. Validar autenticación del usuario
// 2. Verificar que empresa pertenece al usuario
// 3. Validar parámetros (tipo, tamaño, mime type)
// 4. Generar S3 key con nomenclatura estándar
// 5. Crear registro en tabla documentos
// 6. Generar presigned URL de S3 (PUT, 15 min)
// 7. Retornar URL + metadata
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { S3Client, PutObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3.600.0'
import { getSignedUrl } from 'https://esm.sh/@aws-sdk/s3-request-presigner@3.600.0'

// ============================================================================
// Tipos
// ============================================================================

interface RequestBody {
  empresa_id: string
  tipo_documento: string
  nombre_archivo: string
  mime_type: string
  tamano_bytes: number
}

interface ErrorResponse {
  success: false
  error: {
    code: string
    message: string
  }
}

interface SuccessResponse {
  presigned_url: string
  s3_bucket: string
  s3_key: string
  documento_id: string
}

type TipoDocumento =
  | 'camara_comercio'
  | 'registro_accionistas'
  | 'rut'
  | 'cedula_representante_legal'
  | 'declaracion_renta'
  | 'estados_financieros'
  | 'otro'

// ============================================================================
// Constantes
// ============================================================================

const S3_BUCKET = 'bucketn8n-platam'
const S3_REGION = 'us-east-1'
const PRESIGNED_URL_EXPIRATION = 900 // 15 minutos en segundos
const MAX_FILE_SIZE = 10485760 // 10 MB en bytes

const TIPOS_DOCUMENTO_VALIDOS: TipoDocumento[] = [
  'camara_comercio',
  'registro_accionistas',
  'rut',
  'cedula_representante_legal',
  'declaracion_renta',
  'estados_financieros',
  'otro'
]

const MIME_TYPES_PERMITIDOS = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png'
]

// ============================================================================
// Funciones de utilidad
// ============================================================================

/**
 * Sanitiza el nombre del archivo removiendo caracteres especiales
 */
function sanitizeFilename(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/\.[^/.]+$/, '') // Remover extensión
    .replace(/[^a-z0-9._-]/g, '_') // Reemplazar caracteres especiales
    .replace(/_+/g, '_') // Múltiples _ a uno solo
    .replace(/^_|_$/g, '') // Remover _ al inicio y final
    .substring(0, 50) // Max 50 chars
}

/**
 * Genera S3 key con formato estándar
 * Formato: pagadores/{nit}/{tipo_documento}/{timestamp}_{uuid}_{nombre}.{ext}
 */
function generateS3Key(
  nit: string,
  tipoDocumento: string,
  nombreArchivo: string
): string {
  const timestamp = new Date().toISOString()
    .replace(/[-:]/g, '')
    .split('.')[0]
    .replace('T', '_')

  const uuid = crypto.randomUUID().split('-')[0]
  const nombreSanitizado = sanitizeFilename(nombreArchivo)
  const extension = nombreArchivo.split('.').pop()?.toLowerCase() || 'pdf'

  return `confirming/pagadores/${nit}/${tipoDocumento}/${timestamp}_${uuid}_${nombreSanitizado}.${extension}`
}

/**
 * Crea respuesta de error con formato estándar
 */
function errorResponse(code: string, message: string): Response {
  const body: ErrorResponse = {
    success: false,
    error: { code, message }
  }

  let status = 400
  if (code === 'UNAUTHENTICATED') status = 401
  if (code === 'UNAUTHORIZED_EMPRESA') status = 403
  if (code === 'EMPRESA_NOT_FOUND') status = 404
  if (code.includes('S3_ERROR') || code.includes('DATABASE_ERROR')) status = 500

  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

// ============================================================================
// Handler principal
// ============================================================================

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, content-type'
      }
    })
  }

  try {
    // ========================================================================
    // 1. Validar autenticación
    // ========================================================================

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return errorResponse('UNAUTHENTICATED', 'Token de autenticación requerido')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    )

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return errorResponse('UNAUTHENTICATED', 'Token inválido o expirado')
    }

    // ========================================================================
    // 2. Parsear y validar request body
    // ========================================================================

    const body: RequestBody = await req.json()

    // Validar campos requeridos
    if (!body.empresa_id || !body.tipo_documento || !body.nombre_archivo || !body.mime_type || !body.tamano_bytes) {
      return errorResponse('MISSING_FIELD', 'Faltan campos requeridos')
    }

    // Validar tipo de documento
    if (!TIPOS_DOCUMENTO_VALIDOS.includes(body.tipo_documento as TipoDocumento)) {
      return errorResponse('INVALID_TIPO_DOCUMENTO', `Tipo de documento inválido. Valores permitidos: ${TIPOS_DOCUMENTO_VALIDOS.join(', ')}`)
    }

    // Validar tamaño del archivo
    if (body.tamano_bytes > MAX_FILE_SIZE) {
      return errorResponse('INVALID_FILE_SIZE', `El archivo supera el tamaño máximo de ${MAX_FILE_SIZE / 1024 / 1024} MB`)
    }

    // Validar MIME type
    if (!MIME_TYPES_PERMITIDOS.includes(body.mime_type)) {
      return errorResponse('INVALID_FILE_TYPE', `Tipo de archivo no permitido. Valores permitidos: ${MIME_TYPES_PERMITIDOS.join(', ')}`)
    }

    // ========================================================================
    // 3. Verificar que empresa pertenece al usuario
    // ========================================================================

    const { data: empresa, error: empresaError } = await supabase
      .from('empresas_pagadoras')
      .select('nit, usuario_id')
      .eq('id', body.empresa_id)
      .single()

    if (empresaError || !empresa) {
      return errorResponse('EMPRESA_NOT_FOUND', 'La empresa no existe')
    }

    // Verificar permisos (usuario propietario o admin)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (empresa.usuario_id !== user.id && usuario?.rol !== 'admin') {
      return errorResponse('UNAUTHORIZED_EMPRESA', 'No tienes permiso para subir documentos a esta empresa')
    }

    // ========================================================================
    // 4. Generar S3 key
    // ========================================================================

    const s3Key = generateS3Key(
      empresa.nit,
      body.tipo_documento,
      body.nombre_archivo
    )

    // ========================================================================
    // 5. Crear registro en tabla documentos
    // ========================================================================

    const { data: documento, error: documentoError } = await supabase
      .from('documentos')
      .insert({
        empresa_id: body.empresa_id,
        tipo_documento: body.tipo_documento,
        s3_bucket: S3_BUCKET,
        s3_key: s3Key,
        nombre_original: body.nombre_archivo,
        mime_type: body.mime_type,
        tamano_bytes: body.tamano_bytes,
        subido_por: user.id,
        extraccion_completa: false,
        es_version_actual: true
      })
      .select('id')
      .single()

    if (documentoError || !documento) {
      console.error('Error al crear registro de documento:', documentoError)
      return errorResponse('DATABASE_ERROR', 'Error al crear registro de documento en base de datos')
    }

    // ========================================================================
    // 6. Generar presigned URL de S3
    // ========================================================================

    const s3Client = new S3Client({
      region: S3_REGION,
      credentials: {
        accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID') ?? '',
        secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY') ?? ''
      }
    })

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      ContentType: body.mime_type,
      ServerSideEncryption: 'AES256'
    })

    let presignedUrl: string
    try {
      presignedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: PRESIGNED_URL_EXPIRATION
      })
    } catch (s3Error) {
      console.error('Error al generar presigned URL:', s3Error)
      return errorResponse('S3_ERROR', 'Error al generar URL de subida')
    }

    // ========================================================================
    // 7. Retornar respuesta exitosa
    // ========================================================================

    const response: SuccessResponse = {
      presigned_url: presignedUrl,
      s3_bucket: S3_BUCKET,
      s3_key: s3Key,
      documento_id: documento.id
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    console.error('Error inesperado:', error)
    return errorResponse('INTERNAL_ERROR', 'Error interno del servidor')
  }
})
