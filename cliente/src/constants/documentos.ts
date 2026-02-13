import { TipoDocumento } from '@/lib/types'

export interface DocumentoRequerido {
  tipo: TipoDocumento
  nombre: string
  descripcion: string
  formatos: string[]
  maxSize: number
}

export const DOCUMENTOS_REQUERIDOS: DocumentoRequerido[] = [
  {
    tipo: 'camara_comercio',
    nombre: 'Cámara de Comercio',
    descripcion: 'Certificado de existencia y representación legal vigente (máx 30 días)',
    formatos: ['application/pdf'],
    maxSize: 10485760, // 10 MB
  },
  {
    tipo: 'registro_accionistas',
    nombre: 'Registro de Accionistas',
    descripcion: 'Composición accionaria actualizada',
    formatos: ['application/pdf'],
    maxSize: 10485760,
  },
  {
    tipo: 'rut',
    nombre: 'RUT',
    descripcion: 'Registro Único Tributario actualizado',
    formatos: ['application/pdf'],
    maxSize: 10485760,
  },
  {
    tipo: 'cedula_representante_legal',
    nombre: 'Cédula del Representante Legal',
    descripcion: 'Frente y reverso de la cédula (pueden ser 2 archivos o 1 PDF)',
    formatos: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
    maxSize: 10485760,
  },
  {
    tipo: 'declaracion_renta',
    nombre: 'Declaración de Renta',
    descripcion: 'Declaración del último año fiscal',
    formatos: ['application/pdf'],
    maxSize: 10485760,
  },
  {
    tipo: 'estados_financieros',
    nombre: 'Estados Financieros',
    descripcion: 'Balance general y estado de resultados del último año',
    formatos: ['application/pdf'],
    maxSize: 10485760,
  },
]

export const MIME_TYPES_PERMITIDOS = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
]

export const TAMAÑO_MAX_ARCHIVO = 10485760 // 10 MB
