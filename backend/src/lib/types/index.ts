// ============================================================================
// Tipos TypeScript - Backend
// ============================================================================

export type EstadoEmpresa =
  | 'pendiente'
  | 'en_revision'
  | 'documentos_incompletos'
  | 'aprobado'
  | 'rechazado'

export type TipoDocumento =
  | 'camara_comercio'
  | 'registro_accionistas'
  | 'rut'
  | 'cedula_representante_legal'
  | 'declaracion_renta'
  | 'estados_financieros'
  | 'otro'

export type RolUsuario = 'pagador' | 'proveedor' | 'admin'

export interface Usuario {
  id: string
  rol: RolUsuario
  created_at: string
  updated_at: string
}

export interface Empresa {
  id: string
  usuario_id: string
  nit: string
  razon_social: string
  direccion: string
  ciudad: string
  departamento: string
  actividad_economica: string
  codigo_ciiu: string
  representante_legal_nombre: string
  representante_legal_cedula: string
  representante_legal_email: string
  representante_legal_telefono: string
  estado: EstadoEmpresa
  estado_anterior: string | null
  fecha_cambio_estado: string | null
  created_at: string
  updated_at: string
  aprobado_por: string | null
  fecha_aprobacion: string | null
  ip_registro: string | null
  user_agent: string | null
}

export interface Documento {
  id: string
  empresa_id: string
  tipo_documento: TipoDocumento
  s3_bucket: string
  s3_key: string
  nombre_original: string
  mime_type: string
  tamano_bytes: number
  extraccion_completa: boolean
  extraccion_data: any | null
  extraccion_resumen: any | null
  extraccion_confianza: number | null
  extraccion_fecha: string | null
  subido_por: string
  created_at: string
  updated_at: string
  es_version_actual: boolean
  reemplaza_a: string | null
}

export interface HistorialEstado {
  id: string
  empresa_id: string
  estado_anterior: string | null
  estado_nuevo: string
  cambiado_por: string | null
  motivo: string | null
  created_at: string
}

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  meta?: any
}

export interface PresignedUrlResponse {
  presigned_url: string
  s3_bucket: string
  s3_key: string
  documento_id: string
}

export interface DocumentoUrlResponse {
  presigned_url: string
  expires_in: number
  mime_type: string
  nombre_original: string
}
