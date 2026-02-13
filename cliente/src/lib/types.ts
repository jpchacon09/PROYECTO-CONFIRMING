// Tipos basados en el schema de Supabase

export type Rol = 'pagador' | 'proveedor' | 'admin'

export type EstadoEmpresa = 'pendiente' | 'en_revision' | 'documentos_incompletos' | 'aprobado' | 'rechazado'

export type TipoDocumento =
  | 'camara_comercio'
  | 'registro_accionistas'
  | 'rut'
  | 'cedula_representante_legal'
  | 'declaracion_renta'
  | 'estados_financieros'
  | 'otro'

export interface Usuario {
  id: string
  rol: Rol
  created_at: string
  updated_at: string
}

export interface EmpresaPagadora {
  id: string
  usuario_id: string

  // Datos básicos
  nit: string
  razon_social: string
  direccion: string
  ciudad: string
  departamento: string
  actividad_economica: string
  codigo_ciiu: string

  // Representante legal
  representante_legal_nombre: string
  representante_legal_tipo_documento: 'CC' | 'CE'
  representante_legal_cedula: string
  representante_legal_email: string
  representante_legal_telefono: string

  // Estado
  estado: EstadoEmpresa
  estado_anterior: string | null
  fecha_cambio_estado: string | null

  // Metadatos
  created_at: string
  updated_at: string
  aprobado_por: string | null
  fecha_aprobacion: string | null

  // Auditoría
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
  extraccion_data: Record<string, unknown> | null
  extraccion_resumen: Record<string, unknown> | null
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
  estado_anterior: EstadoEmpresa | null
  estado_nuevo: EstadoEmpresa
  cambiado_por: string | null
  motivo: string | null
  created_at: string
}

// Tipos para formularios
export interface DatosEmpresaForm {
  nit: string
  razon_social: string
  direccion: string
  ciudad: string
  departamento: string
  actividad_economica: string
  codigo_ciiu: string
  representante_legal_nombre: string
  representante_legal_tipo_documento: 'CC' | 'CE'
  representante_legal_cedula: string
  representante_legal_email: string
  representante_legal_telefono: string
}

// Tipos para respuestas de Edge Functions
export interface GenerarUrlSubidaResponse {
  presigned_url: string
  s3_bucket: string
  s3_key: string
  documento_id: string
}

export interface ObtenerUrlDocumentoResponse {
  presigned_url: string
}
