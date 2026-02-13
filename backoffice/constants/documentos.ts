// Tipos de documentos según CONTRATO.md
export const TIPOS_DOCUMENTO = {
  CAMARA_COMERCIO: 'camara_comercio',
  REGISTRO_ACCIONISTAS: 'registro_accionistas',
  RUT: 'rut',
  CEDULA_REPRESENTANTE_LEGAL: 'cedula_representante_legal',
  DECLARACION_RENTA: 'declaracion_renta',
  ESTADOS_FINANCIEROS: 'estados_financieros',
  OTRO: 'otro',
} as const

export type TipoDocumento = typeof TIPOS_DOCUMENTO[keyof typeof TIPOS_DOCUMENTO]

export const TIPO_DOCUMENTO_LABELS: Record<TipoDocumento, string> = {
  camara_comercio: 'Cámara de Comercio',
  registro_accionistas: 'Registro de Accionistas',
  rut: 'RUT',
  cedula_representante_legal: 'Cédula Representante Legal',
  declaracion_renta: 'Declaración de Renta',
  estados_financieros: 'Estados Financieros',
  otro: 'Otro',
}

export const DOCUMENTOS_REQUERIDOS: TipoDocumento[] = [
  'camara_comercio',
  'registro_accionistas',
  'rut',
  'cedula_representante_legal',
  'declaracion_renta',
  'estados_financieros',
]

export const MAX_FILE_SIZE = 10485760 // 10 MB
export const MIME_TYPES_PERMITIDOS = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
]
