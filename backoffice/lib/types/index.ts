import type { Database } from './database.types'

// Export types from database
export type Usuario = Database['public']['Tables']['usuarios']['Row']
export type EmpresaPagadora = Database['public']['Tables']['empresas_pagadoras']['Row']
export type Documento = Database['public']['Tables']['documentos']['Row']
export type HistorialEstado = Database['public']['Tables']['historial_estados']['Row']
export type ComentarioInterno = Database['public']['Tables']['comentarios_internos']['Row']
export type NotificacionEnviada = Database['public']['Tables']['notificaciones_enviadas']['Row']

// Insert types
export type InsertEmpresaPagadora = Database['public']['Tables']['empresas_pagadoras']['Insert']
export type InsertDocumento = Database['public']['Tables']['documentos']['Insert']
export type InsertComentarioInterno = Database['public']['Tables']['comentarios_internos']['Insert']

// Update types
export type UpdateEmpresaPagadora = Database['public']['Tables']['empresas_pagadoras']['Update']

// Extended types for joins
export type HistorialEstadoConUsuario = HistorialEstado & {
  usuarios?: Pick<Usuario, 'id'> | null
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

export interface PresignedUrlResponse {
  presigned_url: string
  expires_in: number
  mime_type: string
  nombre_original?: string
}

export interface DocumentoConPresignedUrl extends Documento {
  presigned_url?: string
}

// Form types
export interface CambiarEstadoForm {
  nuevo_estado: EmpresaPagadora['estado']
  motivo: string
}

export interface ComentarioForm {
  comentario: string
}
