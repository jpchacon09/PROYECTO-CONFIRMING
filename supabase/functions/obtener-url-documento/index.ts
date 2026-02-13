// ============================================================================
// Edge Function: obtener-url-documento
// ============================================================================
// Genera presigned URL temporal para visualizar/descargar documento de S3
//
// Flujo:
// 1. Validar autenticación del usuario
// 2. Obtener documento de la base de datos
// 3. Verificar permisos (usuario propietario o admin)
// 4. Generar presigned URL de S3 (GET, 15 min)
// 5. Retornar URL + metadata
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.45.0'

// ============================================================================
// Tipos
// ============================================================================

interface RequestBody {
  documento_id: string
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
  expires_in: number
  mime_type: string
  nombre_original: string
}

interface DocumentoConEmpresa {
  id: string
  s3_bucket: string
  s3_key: string
  mime_type: string
  nombre_original: string
  empresa_id: string
  empresas_pagadoras: {
    usuario_id: string
  } | null
}

const textEncoder = new TextEncoder()

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

async function createPresignedS3GetUrl(
  bucket: string,
  key: string,
  region: string,
  accessKeyId: string,
  secretAccessKey: string,
  expiresIn: number
): Promise<string> {
  const host = `${bucket}.s3.${region}.amazonaws.com`
  const canonicalUri = `/${encodeS3Path(key)}`
  const { amzDate, dateStamp } = amzDates(new Date())
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`

  const query: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresIn),
    'X-Amz-SignedHeaders': 'host'
  }

  const canonicalQuery = buildCanonicalQuery(query)
  const canonicalRequest = [
    'GET',
    canonicalUri,
    canonicalQuery,
    `host:${host}\n`,
    'host',
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

// ============================================================================
// Constantes
// ============================================================================

const S3_REGION = 'us-east-1'
const PRESIGNED_URL_EXPIRATION = 900 // 15 minutos en segundos

// ============================================================================
// Funciones de utilidad
// ============================================================================

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
  if (code === 'UNAUTHORIZED_DOCUMENTO') status = 403
  if (code === 'DOCUMENTO_NOT_FOUND') status = 404
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

    if (!body.documento_id) {
      return errorResponse('MISSING_FIELD', 'documento_id es requerido')
    }

    // ========================================================================
    // 3. Obtener documento de la base de datos
    // ========================================================================

    const { data: documento, error: documentoError } = await supabaseAdmin
      .from('documentos')
      .select(`
        id,
        s3_bucket,
        s3_key,
        mime_type,
        nombre_original,
        empresa_id,
        empresas_pagadoras (
          usuario_id
        )
      `)
      .eq('id', body.documento_id)
      .single()

    if (documentoError || !documento) {
      return errorResponse('DOCUMENTO_NOT_FOUND', 'El documento no existe')
    }

    const documentoData = documento as DocumentoConEmpresa

    // ========================================================================
    // 4. Verificar permisos
    // ========================================================================

    // Obtener rol del usuario
    const { data: usuario } = await supabaseAdmin
      .from('usuarios')
      .select('rol')
      .eq('id', userId)
      .single()

    // Verificar si es admin o propietario de la empresa
    const esAdmin = usuario?.rol === 'admin'
    const esPropietario = documentoData.empresas_pagadoras?.usuario_id === userId

    if (!esAdmin && !esPropietario) {
      return errorResponse('UNAUTHORIZED_DOCUMENTO', 'No tienes permiso para ver este documento')
    }

    // ========================================================================
    // 5. Generar presigned URL de S3 (sin SDK remoto para evitar fallos 502)
    // ========================================================================

    const awsAccessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID') ?? ''
    const awsSecretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY') ?? ''
    if (!awsAccessKeyId || !awsSecretAccessKey) {
      return errorResponse('CONFIG_ERROR', 'Faltan variables de entorno de AWS en la función')
    }

    const bucket = (documentoData.s3_bucket ?? '').trim()
    const key = (documentoData.s3_key ?? '').trim()
    if (!bucket || !key) {
      // Si `key` queda vacío, el presign apunta al root del bucket y S3 responde con ListBucket/AccessDenied.
      return errorResponse('DOCUMENTO_STORAGE_INVALID', 'Documento sin ruta S3 válida (s3_bucket/s3_key)')
    }

    let presignedUrl: string
    try {
      presignedUrl = await createPresignedS3GetUrl(
        bucket,
        key,
        S3_REGION,
        awsAccessKeyId,
        awsSecretAccessKey,
        PRESIGNED_URL_EXPIRATION
      )
    } catch (s3Error) {
      console.error('Error al generar presigned URL:', s3Error)
      return errorResponse('S3_ERROR', 'Error al generar URL de descarga')
    }

    // ========================================================================
    // 6. Retornar respuesta exitosa
    // ========================================================================

    const response: SuccessResponse = {
      presigned_url: presignedUrl,
      expires_in: PRESIGNED_URL_EXPIRATION,
      mime_type: documentoData.mime_type,
      nombre_original: documentoData.nombre_original
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
