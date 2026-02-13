import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { ApiResponse, Usuario, EmpresaPagadora, UpdateEmpresaPagadora } from '@/lib/types'

const ESTADOS_VALIDOS = [
  'pendiente',
  'en_revision',
  'documentos_incompletos',
  'aprobado',
  'rechazado'
] as const
type EstadoValido = (typeof ESTADOS_VALIDOS)[number]

function isEstadoValido(value: string): value is EstadoValido {
  return (ESTADOS_VALIDOS as readonly string[]).includes(value)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const headerAuth = req.headers.get('authorization')
    const headerToken = headerAuth?.toLowerCase().startsWith('bearer ')
      ? headerAuth.slice(7).trim()
      : null

    // Verificar autenticación
    const supabase = await createServerSupabaseClient({ accessToken: headerToken })
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Token inválido o expirado'
        }
      }, { status: 401 })
    }

    // Verificar rol admin
    const { data: usuarioData, error: usuarioError } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (usuarioError || !usuarioData) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'ADMIN_REQUIRED',
          message: 'Usuario no encontrado'
        }
      }, { status: 403 })
    }

    const usuario = usuarioData as Usuario

    if (usuario.rol !== 'admin') {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'ADMIN_REQUIRED',
          message: 'Solo administradores pueden cambiar el estado'
        }
      }, { status: 403 })
    }

    // Parsear body
    const body = (await req.json()) as { nuevo_estado?: string; motivo?: string }
    const nuevo_estado = body.nuevo_estado
    // `motivo` se guarda via trigger si lo implementamos en el futuro; por ahora no lo persistimos en DB
    // para evitar depender de policies de INSERT en historial_estados.

    // Validar estado
    if (!nuevo_estado || !isEstadoValido(nuevo_estado)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'INVALID_ESTADO',
          message: `Estado inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}`
        }
      }, { status: 400 })
    }

    // Obtener empresa actual (con token del admin; RLS permite SELECT a admins)
    const { data: empresaData, error: empresaError } = await supabase
      .from('empresas_pagadoras')
      .select('*')
      .eq('id', params.id)
      .single()

    if (empresaError || !empresaData) {
      if (empresaError) console.error('Error al buscar empresa:', empresaError)
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'EMPRESA_NOT_FOUND',
          message: 'La empresa no existe'
        }
      }, { status: 404 })
    }

    const empresa = empresaData as EmpresaPagadora

    // Preparar datos de actualización
    const updateData: UpdateEmpresaPagadora = {
      estado: nuevo_estado,
      estado_anterior: empresa.estado,
      fecha_cambio_estado: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    if (nuevo_estado === 'aprobado') {
      updateData.aprobado_por = user.id
      updateData.fecha_aprobacion = new Date().toISOString()
    }

    // Actualizar estado (RLS permite UPDATE a admins). El trigger en DB registra historial automaticamente.
    const { error: updateError } = await supabase
      .from('empresas_pagadoras')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error al actualizar estado:', updateError)
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Error al actualizar el estado de la empresa'
        }
      }, { status: 500 })
    }

    return NextResponse.json<ApiResponse<{
      empresa_id: string
      estado_anterior: EmpresaPagadora['estado']
      estado_nuevo: EstadoValido
      cambiado_por: string
      fecha_cambio: string
    }>>({
      success: true,
      data: {
        empresa_id: params.id,
        estado_anterior: empresa.estado,
        estado_nuevo: nuevo_estado,
        cambiado_por: user.id,
        fecha_cambio: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Error en PATCH /api/admin/empresas/[id]/estado:', error)
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor'
      }
    }, { status: 500 })
  }
}
