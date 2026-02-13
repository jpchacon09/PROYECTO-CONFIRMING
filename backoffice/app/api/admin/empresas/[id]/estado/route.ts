import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { ApiResponse, Usuario, EmpresaPagadora } from '@/lib/types'

const ESTADOS_VALIDOS = [
  'pendiente',
  'en_revision',
  'documentos_incompletos',
  'aprobado',
  'rechazado'
] as const

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar autenticación
    const supabase = await createServerSupabaseClient()
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
    const body = await req.json()
    const { nuevo_estado, motivo } = body

    // Validar estado
    if (!nuevo_estado || !ESTADOS_VALIDOS.includes(nuevo_estado)) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'INVALID_ESTADO',
          message: `Estado inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}`
        }
      }, { status: 400 })
    }

    // Obtener empresa actual
    const { data: empresaData, error: empresaError } = await supabaseAdmin
      .from('empresas_pagadoras')
      .select('*')
      .eq('id', params.id)
      .single()

    if (empresaError || !empresaData) {
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
    const updateData: any = {
      estado: nuevo_estado,
      estado_anterior: empresa.estado,
      fecha_cambio_estado: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    if (nuevo_estado === 'aprobado') {
      updateData.aprobado_por = user.id
      updateData.fecha_aprobacion = new Date().toISOString()
    }

    // Actualizar estado usando Supabase Admin (bypass RLS)
    // @ts-ignore - Supabase types issue
    const { data: empresaActualizada, error: updateError } = await supabaseAdmin
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

    // El trigger de Supabase debería crear el registro en historial_estados automáticamente
    // Pero si no existe, lo creamos manualmente
    await supabaseAdmin
      .from('historial_estados')
      .insert({
        empresa_id: params.id,
        estado_anterior: empresa.estado,
        estado_nuevo: nuevo_estado,
        cambiado_por: user.id,
        motivo: motivo || null
      })

    return NextResponse.json<ApiResponse<any>>({
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
