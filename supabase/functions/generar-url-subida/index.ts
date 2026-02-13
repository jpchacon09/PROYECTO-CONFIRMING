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
import { createClient } from 'npm:@supabase/supabase-js@2.45.0'

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

// Bucket definitivo para documentos (segun decisión del proyecto).
const S3_BUCKET = 'n8nagentrobust'
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

const textEncoder = new TextEncoder()

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

async function getUserIdFromToken(
  supabaseUrl: string,
  supabaseAnonKey: string,
  token: string
): Promise<string | null> {
  try {
    const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey
      }
    })

    if (!resp.ok) return null
    const user = await resp.json().catch(() => null)
    return typeof user?.id === 'string' ? user.id : null
  } catch {
    return null
  }
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(value))
  return toHex(digest)
}

async function hmacSha256(
  key: ArrayBuffer | string,
  value: string
): Promise<ArrayBuffer> {
  const keyBytes = typeof key === 'string' ? textEncoder.encode(key) : new Uint8Array(key)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  return await crypto.subtle.sign('HMAC', cryptoKey, textEncoder.encode(value))
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  )
}

function encodeS3Path(key: string): string {
  return key
    .split('/')
    .map((segment) => encodeRfc3986(segment))
    .join('/')
}

function amzDates(now: Date): { amzDate: string; dateStamp: string } {
  const iso = now.toISOString()
  const dateStamp = iso.slice(0, 10).replace(/-/g, '')
  const amzDate = `${dateStamp}T${iso.slice(11, 19).replace(/:/g, '')}Z`
  return { amzDate, dateStamp }
}

function buildCanonicalQuery(query: Record<string, string>): string {
  return Object.entries(query)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join('&')
}

async function deriveSigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string
): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(`AWS4${secretAccessKey}`, dateStamp)
  const kRegion = await hmacSha256(kDate, region)
  const kService = await hmacSha256(kRegion, 's3')
  return await hmacSha256(kService, 'aws4_request')
}

async function createPresignedS3PutUrl(
  bucket: string,
  key: string,
  region: string,
  accessKeyId: string,
  secretAccessKey: string,
  expiresIn: number,
  serverSideEncryption: 'AES256' | null
): Promise<string> {
  const host = `${bucket}.s3.${region}.amazonaws.com`
  const canonicalUri = `/${encodeS3Path(key)}`
  const { amzDate, dateStamp } = amzDates(new Date())
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`

  // For presigned URLs: any x-amz-* header present in the actual request must be signed.
  // The frontend sends `x-amz-server-side-encryption: AES256`, so we must sign it.
  const signedHeaderNames = serverSideEncryption
    ? 'host;x-amz-server-side-encryption'
    : 'host'

  const query: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresIn),
    'X-Amz-SignedHeaders': signedHeaderNames
  }

  const canonicalQuery = buildCanonicalQuery(query)

  const canonicalHeaders = serverSideEncryption
    ? `host:${host}\nx-amz-server-side-encryption:${serverSideEncryption}\n`
    : `host:${host}\n`

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaderNames,
    'UNSIGNED-PAYLOAD'
  ].join('\n')

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest)
  ].join('\n')

  const signingKey = await deriveSigningKey(secretAccessKey, dateStamp, region)
  const signature = toHex(await hmacSha256(signingKey, stringToSign))
  const finalQuery = `${canonicalQuery}&X-Amz-Signature=${signature}`

  return `https://${host}${canonicalUri}?${finalQuery}`
}

/**
 * Genera S3 key con formato estándar
 * Formato: CONFIRMING/pagadores/{nit}/{tipo_documento}/{timestamp}_{uuid}_{nombre}.{ext}
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

  // Nota: S3 es case-sensitive. El bucket ya tiene carpeta/prefijo "CONFIRMING/".
  return `CONFIRMING/pagadores/${nit}/${tipoDocumento}/${timestamp}_${uuid}_${nombreSanitizado}.${extension}`
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
  if (code === 'CONFIG_ERROR') status = 500
  if (code.includes('S3_ERROR') || code.includes('DATABASE_ERROR')) status = 500

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
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
        'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey'
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return errorResponse('CONFIG_ERROR', 'Faltan variables de entorno de Supabase en la función')
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) {
      return errorResponse('UNAUTHENTICATED', 'Token de autenticación inválido')
    }

    // verify_jwt=false en gateway: verificamos el token contra GoTrue para evitar JWTs falsificados
    const userId = await getUserIdFromToken(supabaseUrl, supabaseAnonKey, token)
    if (!userId) {
      return errorResponse('UNAUTHENTICATED', 'Token inválido o expirado')
    }

    // Cliente admin para operar DB sin depender de RLS.
    // El JWT ya fue validado por el gateway de Supabase (verify_jwt=true).
    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey
    )

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

    const { data: empresa, error: empresaError } = await supabaseAdmin
      .from('empresas_pagadoras')
      .select('nit, usuario_id')
      .eq('id', body.empresa_id)
      .single()

    if (empresaError || !empresa) {
      return errorResponse('EMPRESA_NOT_FOUND', 'La empresa no existe')
    }

    // Verificar permisos (usuario propietario o admin)
    const { data: usuario } = await supabaseAdmin
      .from('usuarios')
      .select('rol')
      .eq('id', userId)
      .single()

    if (empresa.usuario_id !== userId && usuario?.rol !== 'admin') {
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
    // 5. Generar presigned URL de S3 (sin SDK remoto para evitar fallos 502)
    // ========================================================================

    const awsAccessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID') ?? ''
    const awsSecretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY') ?? ''
    if (!awsAccessKeyId || !awsSecretAccessKey) {
      return errorResponse('CONFIG_ERROR', 'Faltan variables de entorno de AWS en la función')
    }

    let presignedUrl: string
    try {
      presignedUrl = await createPresignedS3PutUrl(
        S3_BUCKET,
        s3Key,
        S3_REGION,
        awsAccessKeyId,
        awsSecretAccessKey,
        PRESIGNED_URL_EXPIRATION,
        'AES256'
      )
    } catch (s3Error) {
      console.error('Error al generar presigned URL:', s3Error)
      return errorResponse('S3_ERROR', 'Error al generar URL de subida')
    }

    // ========================================================================
    // 6. Crear registro en tabla documentos
    // ========================================================================

    const { data: documento, error: documentoError } = await supabaseAdmin
      .from('documentos')
      .insert({
        empresa_id: body.empresa_id,
        tipo_documento: body.tipo_documento,
        s3_bucket: S3_BUCKET,
        s3_key: s3Key,
        nombre_original: body.nombre_archivo,
        mime_type: body.mime_type,
        tamano_bytes: body.tamano_bytes,
        subido_por: userId,
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
