import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ApiResponse, Empresa } from '@/lib/types'

export async function GET(req: NextRequest) {
  try {
    // Obtener token del header
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Token de autenticación requerido'
        }
      }, { status: 401 })
    }

    // Verificar usuario
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Token inválido o expirado'
        }
      }, { status: 401 })
    }

    // Obtener empresa del usuario
    const { data: empresa, error: empresaError } = await supabaseAdmin
      .from('empresas_pagadoras')
      .select('*')
      .eq('usuario_id', user.id)
      .single()

    if (empresaError || !empresa) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: {
          code: 'EMPRESA_NOT_FOUND',
          message: 'No tienes una empresa registrada'
        }
      }, { status: 404 })
    }

    return NextResponse.json<ApiResponse<Empresa>>({
      success: true,
      data: empresa
    })
  } catch (error) {
    console.error('Error en /api/empresas/me:', error)
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor'
      }
    }, { status: 500 })
  }
}
