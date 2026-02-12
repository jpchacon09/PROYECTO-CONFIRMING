// ============================================================================
// CÓDIGO DE UTILIDAD PARA LOVABLE - ONBOARDING PAGADORES
// ============================================================================
// Copiar las funciones que necesites en tu proyecto Lovable

// ============================================================================
// SCHEMAS DE VALIDACIÓN (Zod)
// ============================================================================

import { z } from 'zod'

// Schema para el formulario de datos de empresa
export const empresaFormSchema = z.object({
  // Datos de la empresa
  nit: z.string()
    .regex(/^\d{9}-\d{1}$/, {
      message: "El NIT debe tener el formato XXXXXXXXX-X (ej: 900123456-7)"
    }),

  razon_social: z.string()
    .min(3, "La razón social debe tener mínimo 3 caracteres")
    .max(255, "La razón social es muy larga"),

  direccion: z.string()
    .min(10, "La dirección debe ser más específica")
    .max(500, "La dirección es muy larga"),

  ciudad: z.string()
    .min(3, "Ingresa una ciudad válida")
    .max(100, "El nombre de la ciudad es muy largo"),

  departamento: z.string()
    .min(3, "Selecciona un departamento"),

  actividad_economica: z.string()
    .min(5, "Describe la actividad económica")
    .max(255, "La descripción es muy larga"),

  codigo_ciiu: z.string()
    .regex(/^\d{4}$/, {
      message: "El código CIIU debe tener 4 dígitos (ej: 6201)"
    }),

  // Datos del representante legal
  representante_legal_nombre: z.string()
    .min(5, "Ingresa el nombre completo")
    .max(255, "El nombre es muy largo"),

  representante_legal_cedula: z.string()
    .regex(/^\d{6,10}$/, {
      message: "La cédula debe tener entre 6 y 10 dígitos"
    }),

  representante_legal_email: z.string()
    .email("Ingresa un email válido"),

  representante_legal_telefono: z.string()
    .regex(/^\+57\d{10}$/, {
      message: "El teléfono debe tener el formato +57XXXXXXXXXX (ej: +573001234567)"
    })
})

export type EmpresaFormData = z.infer<typeof empresaFormSchema>

// ============================================================================
// TIPOS DE TYPESCRIPT
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

// ============================================================================
// CONSTANTES
// ============================================================================

export const DEPARTAMENTOS_COLOMBIA = [
  'Amazonas',
  'Antioquia',
  'Arauca',
  'Atlántico',
  'Bolívar',
  'Boyacá',
  'Caldas',
  'Caquetá',
  'Casanare',
  'Cauca',
  'Cesar',
  'Chocó',
  'Córdoba',
  'Cundinamarca',
  'Guainía',
  'Guaviare',
  'Huila',
  'La Guajira',
  'Magdalena',
  'Meta',
  'Nariño',
  'Norte de Santander',
  'Putumayo',
  'Quindío',
  'Risaralda',
  'San Andrés y Providencia',
  'Santander',
  'Sucre',
  'Tolima',
  'Valle del Cauca',
  'Vaupés',
  'Vichada'
]

export const DOCUMENTOS_REQUERIDOS: Record<TipoDocumento, {
  nombre: string
  descripcion: string
  formatos: string[]
  icono: string
}> = {
  camara_comercio: {
    nombre: 'Cámara de Comercio',
    descripcion: 'Certificado de existencia y representación legal vigente (máx 30 días)',
    formatos: ['PDF'],
    icono: 'FileText'
  },
  registro_accionistas: {
    nombre: 'Registro de Accionistas',
    descripcion: 'Composición accionaria actualizada',
    formatos: ['PDF'],
    icono: 'Users'
  },
  rut: {
    nombre: 'RUT',
    descripcion: 'Registro Único Tributario actualizado',
    formatos: ['PDF'],
    icono: 'FileCheck'
  },
  cedula_representante_legal: {
    nombre: 'Cédula del Representante Legal',
    descripcion: 'Frente y reverso de la cédula (pueden ser 2 archivos o 1 PDF)',
    formatos: ['JPG', 'PNG', 'PDF'],
    icono: 'CreditCard'
  },
  declaracion_renta: {
    nombre: 'Declaración de Renta',
    descripcion: 'Declaración del último año fiscal',
    formatos: ['PDF'],
    icono: 'Calculator'
  },
  estados_financieros: {
    nombre: 'Estados Financieros',
    descripcion: 'Balance general y estado de resultados del último año',
    formatos: ['PDF'],
    icono: 'BarChart3'
  },
  otro: {
    nombre: 'Otro Documento',
    descripcion: 'Documento adicional',
    formatos: ['PDF', 'JPG', 'PNG'],
    icono: 'File'
  }
}

export const ESTADO_BADGES: Record<EstadoEmpresa, {
  label: string
  color: string
  bgColor: string
}> = {
  pendiente: {
    label: 'Pendiente',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100'
  },
  en_revision: {
    label: 'En Revisión',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100'
  },
  documentos_incompletos: {
    label: 'Documentos Incompletos',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100'
  },
  aprobado: {
    label: 'Aprobado',
    color: 'text-green-700',
    bgColor: 'bg-green-100'
  },
  rechazado: {
    label: 'Rechazado',
    color: 'text-red-700',
    bgColor: 'bg-red-100'
  }
}

// ============================================================================
// FUNCIONES DE VALIDACIÓN
// ============================================================================

export const validarNIT = (nit: string): boolean => {
  return /^\d{9}-\d{1}$/.test(nit)
}

export const validarEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export const validarTelefonoColombia = (telefono: string): boolean => {
  return /^\+57\d{10}$/.test(telefono)
}

export const validarCIIU = (ciiu: string): boolean => {
  return /^\d{4}$/.test(ciiu)
}

export const validarArchivo = (file: File): {
  valid: boolean
  error?: string
} => {
  const maxSize = 10485760 // 10 MB
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']

  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'El archivo supera el tamaño máximo de 10 MB'
    }
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Solo se permiten archivos PDF, JPG o PNG'
    }
  }

  return { valid: true }
}

// ============================================================================
// FUNCIONES DE FORMATEO
// ============================================================================

export const formatearFecha = (fecha: string): string => {
  const date = new Date(fecha)
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

export const formatearFechaCorta = (fecha: string): string => {
  const date = new Date(fecha)
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date)
}

export const formatearTamanoArchivo = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

export const formatearNIT = (nit: string): string => {
  // Eliminar caracteres no numéricos
  const cleaned = nit.replace(/\D/g, '')

  // Si tiene al menos 10 dígitos, formatear como XXXXXXXXX-X
  if (cleaned.length >= 10) {
    return cleaned.slice(0, 9) + '-' + cleaned.slice(9, 10)
  }

  return cleaned
}

export const formatearTelefono = (telefono: string): string => {
  // Eliminar caracteres no numéricos excepto el +
  let cleaned = telefono.replace(/[^\d+]/g, '')

  // Si no empieza con +57, agregarlo
  if (!cleaned.startsWith('+57')) {
    cleaned = '+57' + cleaned.replace(/^\+/, '')
  }

  // Limitar a 13 caracteres (+57 + 10 dígitos)
  return cleaned.slice(0, 13)
}

// ============================================================================
// HOOK PERSONALIZADO PARA SUBIDA DE DOCUMENTOS
// ============================================================================

import { useState } from 'react'
import { SupabaseClient } from '@supabase/supabase-js'

export const useUploadDocumento = (supabase: SupabaseClient) => {
  const [uploading, setUploading] = useState<string | null>(null)
  const [progress, setProgress] = useState<number>(0)

  const uploadDocumento = async (
    file: File,
    empresaId: string,
    tipoDocumento: TipoDocumento
  ): Promise<{ success: boolean; error?: string; documentoId?: string }> => {
    // Validar archivo
    const validation = validarArchivo(file)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    setUploading(tipoDocumento)
    setProgress(0)

    try {
      // Paso 1: Llamar Edge Function para obtener presigned URL
      setProgress(20)
      const { data, error: edgeFunctionError } = await supabase.functions.invoke(
        'generar-url-subida',
        {
          body: {
            empresa_id: empresaId,
            tipo_documento: tipoDocumento,
            nombre_archivo: file.name,
            mime_type: file.type,
            tamano_bytes: file.size
          }
        }
      )

      if (edgeFunctionError) {
        throw new Error(edgeFunctionError.message)
      }

      // Paso 2: Subir archivo a S3 usando presigned URL
      setProgress(50)
      const uploadResponse = await fetch(data.presigned_url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      })

      if (!uploadResponse.ok) {
        throw new Error('Error al subir el archivo a S3')
      }

      setProgress(100)

      return {
        success: true,
        documentoId: data.documento_id
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Error desconocido al subir el documento'
      }
    } finally {
      setUploading(null)
      setProgress(0)
    }
  }

  return {
    uploadDocumento,
    uploading,
    progress
  }
}

// ============================================================================
// HOOK PARA OBTENER CLIENTE IP (opcional)
// ============================================================================

export const useClientIP = () => {
  const [ip, setIP] = useState<string | null>(null)

  const getIP = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json')
      const data = await response.json()
      setIP(data.ip)
      return data.ip
    } catch (error) {
      console.error('Error al obtener IP:', error)
      return null
    }
  }

  return { ip, getIP }
}

// ============================================================================
// HELPER PARA INICIALIZAR O REDIRIGIR USUARIO
// ============================================================================

import { User } from '@supabase/supabase-js'
import { NavigateFunction } from 'react-router-dom'

export const handleUserRedirect = async (
  user: User,
  supabase: SupabaseClient,
  navigate: NavigateFunction
) => {
  // 1. Verificar si existe en tabla usuarios
  const { data: usuario, error: usuarioError } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', user.id)
    .single()

  // 2. Si no existe, crear con rol 'pagador'
  if (!usuario && !usuarioError) {
    await supabase
      .from('usuarios')
      .insert({ id: user.id, rol: 'pagador' })
  }

  // 3. Verificar si ya tiene una empresa registrada
  const { data: empresa, error: empresaError } = await supabase
    .from('empresas_pagadoras')
    .select('*')
    .eq('usuario_id', user.id)
    .single()

  // 4. Redirigir según el caso
  if (!empresa && !empresaError) {
    // Primera vez, ir a formulario
    navigate('/onboarding/datos-empresa')
  } else if (empresa && empresa.estado === 'documentos_incompletos') {
    // Puede editar, ir a documentos
    navigate('/onboarding/documentos')
  } else if (empresa) {
    // Ver estado de solicitud
    navigate('/dashboard')
  } else {
    // Fallback
    navigate('/onboarding/datos-empresa')
  }
}

// ============================================================================
// COMPONENTE DE EJEMPLO: Badge de Estado
// ============================================================================

interface EstadoBadgeProps {
  estado: EstadoEmpresa
}

export const EstadoBadge: React.FC<EstadoBadgeProps> = ({ estado }) => {
  const config = ESTADO_BADGES[estado]

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.color} ${config.bgColor}`}
    >
      {config.label}
    </span>
  )
}

// ============================================================================
// COMPONENTE DE EJEMPLO: Progress Bar
// ============================================================================

interface ProgressBarProps {
  progress: number // 0 a 100
  label?: string
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, label }) => {
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className="text-sm font-medium text-gray-700">{progress}%</span>
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

// ============================================================================
// FUNCIONES PARA CALCULAR PROGRESO DEL ONBOARDING
// ============================================================================

export const calcularProgresoOnboarding = (
  empresaCreada: boolean,
  documentosSubidos: number
): number => {
  const totalPasos = 2 // 1. Crear empresa, 2. Subir 6 documentos
  const documentosRequeridos = 6

  let progreso = 0

  if (empresaCreada) {
    progreso += 50 // 50% por crear la empresa
  }

  if (documentosSubidos > 0) {
    progreso += (documentosSubidos / documentosRequeridos) * 50 // Hasta 50% por documentos
  }

  return Math.round(progreso)
}

export const verificarOnboardingCompleto = (
  documentos: Documento[]
): boolean => {
  const tiposRequeridos: TipoDocumento[] = [
    'camara_comercio',
    'registro_accionistas',
    'rut',
    'cedula_representante_legal',
    'declaracion_renta',
    'estados_financieros'
  ]

  const tiposSubidos = new Set(
    documentos
      .filter(doc => doc.es_version_actual)
      .map(doc => doc.tipo_documento)
  )

  return tiposRequeridos.every(tipo => tiposSubidos.has(tipo))
}

// ============================================================================
// EJEMPLOS DE USO
// ============================================================================

/*

// Ejemplo 1: Validar formulario con Zod
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

const FormularioDatosEmpresa = () => {
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<EmpresaFormData>({
    resolver: zodResolver(empresaFormSchema)
  })

  const onSubmit = async (data: EmpresaFormData) => {
    // Guardar en Supabase
    const { error } = await supabase
      .from('empresas_pagadoras')
      .insert({
        usuario_id: user.id,
        ...data
      })

    if (error) {
      toast.error('Error al guardar: ' + error.message)
    } else {
      toast.success('Datos guardados correctamente')
      navigate('/onboarding/documentos')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('nit')} />
      {errors.nit && <span>{errors.nit.message}</span>}

      <input {...register('razon_social')} />
      {errors.razon_social && <span>{errors.razon_social.message}</span>}

      // ... más campos
    </form>
  )
}

// Ejemplo 2: Subir documento
import { useUploadDocumento } from './utils'

const SubidaDocumentos = () => {
  const { uploadDocumento, uploading, progress } = useUploadDocumento(supabase)

  const handleUpload = async (file: File, tipo: TipoDocumento) => {
    const result = await uploadDocumento(file, empresaId, tipo)

    if (result.success) {
      toast.success('Documento subido correctamente')
      // Refrescar lista de documentos
    } else {
      toast.error(result.error)
    }
  }

  return (
    <div>
      <input
        type="file"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            handleUpload(file, 'rut')
          }
        }}
      />
      {uploading && <ProgressBar progress={progress} label="Subiendo..." />}
    </div>
  )
}

// Ejemplo 3: Mostrar badge de estado
import { EstadoBadge } from './utils'

const DashboardEmpresa = () => {
  return (
    <div>
      <h1>{empresa.razon_social}</h1>
      <EstadoBadge estado={empresa.estado} />
    </div>
  )
}

*/

// ============================================================================
// FIN DEL ARCHIVO
// ============================================================================
