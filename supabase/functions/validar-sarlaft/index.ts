// ============================================================================
// Edge Function: validar-sarlaft
// ============================================================================
// Proxy seguro (server-side) para validar documentos en SARLAFT via endpoint externo.
// - Evita problemas de CORS desde navegador
// - Valida el JWT del usuario contra GoTrue (verify_jwt=false en gateway)
// - Opcionalmente guarda el resultado en DB (tabla `validaciones_sarlaft`)
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.45.0'

interface RequestBody {
  empresa_id: string
  scope?: 'empresa' | 'representante' | string

  nombres: string
  documento: string
  tipo_documento: string

  user_id?: string
  ip_address?: string
  force_refresh?: boolean
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
      ...init?.headers
    }
  })
}

function errorResponse(code: string, message: string, status = 400, details?: Record<string, unknown>) {
  return jsonResponse(
    {
      success: false,
      error: { code, message, details: details ?? undefined }
    },
    { status }
  )
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey'
      }
    })
  }

  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 'Metodo no permitido', 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return errorResponse('UNAUTHENTICATED', 'Token de autenticacion requerido', 401)
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    return errorResponse('UNAUTHENTICATED', 'Token de autenticacion invalido', 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return errorResponse('CONFIG_ERROR', 'Faltan variables de entorno de Supabase en la funcion', 500)
  }

  // verify_jwt=false en gateway: verificamos el token contra GoTrue para evitar JWTs falsificados
  const userId = await getUserIdFromToken(supabaseUrl, supabaseAnonKey, token)
  if (!userId) {
    return errorResponse('UNAUTHENTICATED', 'Token invalido o expirado', 401)
  }

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return errorResponse('BAD_REQUEST', 'JSON invalido', 400)
  }

  const empresaId = (body.empresa_id ?? '').trim()
  const nombres = (body.nombres ?? '').trim()
  const documento = (body.documento ?? '').trim()
  const tipo_documento = (body.tipo_documento ?? '').trim().toUpperCase()
  const scope = (body.scope ?? 'representante').trim()
  const force_refresh = Boolean(body.force_refresh)

  if (!empresaId || !nombres || !documento || !tipo_documento) {
    return errorResponse('MISSING_FIELD', 'Faltan campos requeridos: empresa_id, nombres, documento, tipo_documento', 400)
  }

  const ip_address = typeof body.ip_address === 'string' ? body.ip_address : (req.headers.get('x-forwarded-for') ?? '')
  const user_id = (Deno.env.get('SARLAFT_USER_ID') ?? body.user_id ?? 'agentrobust').trim()
  const validateUrl = (Deno.env.get('SARLAFT_VALIDATE_URL') ?? 'http://44.219.204.30:8000/api/validate').trim()

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

  // Verificar permisos (usuario propietario o admin) para asociar la validacion a una empresa
  const { data: empresa, error: empresaError } = await supabaseAdmin
    .from('empresas_pagadoras')
    .select('usuario_id, nit')
    .eq('id', empresaId)
    .single()

  if (empresaError || !empresa) {
    return errorResponse('EMPRESA_NOT_FOUND', 'La empresa no existe', 404)
  }

  const { data: usuario } = await supabaseAdmin
    .from('usuarios')
    .select('rol')
    .eq('id', userId)
    .single()

  if (empresa.usuario_id !== userId && usuario?.rol !== 'admin') {
    return errorResponse('UNAUTHORIZED_EMPRESA', 'No tienes permiso para validar SARLAFT para esta empresa', 403)
  }

  // Llamar endpoint externo (Sarlaft via n8n)
  let providerStatus = 0
  let providerBody: unknown = null
  try {
    const resp = await fetch(validateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombres,
        documento,
        tipo_documento,
        user_id,
        ip_address,
        force_refresh
      })
    })
    providerStatus = resp.status
    const text = await resp.text()
    if (text) {
      try {
        providerBody = JSON.parse(text) as unknown
      } catch {
        providerBody = { raw: text }
      }
    } else {
      providerBody = null
    }

    if (!resp.ok) {
      return errorResponse(
        'SARLAFT_ERROR',
        'Error consultando el servicio de validacion SARLAFT',
        502,
        { status: providerStatus, body: providerBody }
      )
    }
  } catch (e) {
    return errorResponse(
      'SARLAFT_UNREACHABLE',
      'No se pudo conectar al servicio de validacion SARLAFT',
      502,
      { message: e instanceof Error ? e.message : String(e) }
    )
  }

  // Guardar resultado (si la tabla existe)
  let saved = false
  try {
    const { error: insertError } = await supabaseAdmin
      .from('validaciones_sarlaft')
      .insert({
        empresa_id: empresaId,
        usuario_id: userId,
        scope,
        nombres,
        documento,
        tipo_documento,
        user_id,
        ip_address: ip_address || null,
        force_refresh,
        resultado: providerBody ?? {},
        provider_status: providerStatus
      })

    if (!insertError) saved = true
  } catch {
    // Tabla no existe o schema no actualizado: no bloqueamos el flujo
    saved = false
  }

  return jsonResponse({
    success: true,
    empresa_id: empresaId,
    scope,
    saved,
    provider_status: providerStatus,
    resultado: providerBody
  })
})
