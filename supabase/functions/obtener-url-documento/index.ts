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
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { S3Client, GetObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3.600.0'
import { getSignedUrl } from 'https://esm.sh/@aws-sdk/s3-request-presigner@3.600.0'

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

    // Usar service key para bypass RLS (verificaremos permisos manualmente)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Cliente regular para verificar usuario
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

    // ========================================================================
    // 4. Verificar permisos
    // ========================================================================

    // Obtener rol del usuario
    const { data: usuario } = await supabaseAdmin
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    // Verificar si es admin o propietario de la empresa
    const esAdmin = usuario?.rol === 'admin'
    const esPropietario = (documento as any).empresas_pagadoras?.usuario_id === user.id

    if (!esAdmin && !esPropietario) {
      return errorResponse('UNAUTHORIZED_DOCUMENTO', 'No tienes permiso para ver este documento')
    }

    // ========================================================================
    // 5. Generar presigned URL de S3
    // ========================================================================

    const s3Client = new S3Client({
      region: S3_REGION,
      credentials: {
        accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID') ?? '',
        secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY') ?? ''
      }
    })

    const command = new GetObjectCommand({
      Bucket: documento.s3_bucket,
      Key: documento.s3_key
    })

    let presignedUrl: string
    try {
      presignedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: PRESIGNED_URL_EXPIRATION
      })
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
      mime_type: documento.mime_type,
      nombre_original: documento.nombre_original
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
