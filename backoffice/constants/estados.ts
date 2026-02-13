// Estados del onboarding según CONTRATO.md
export const ESTADOS_EMPRESA = {
  PENDIENTE: 'pendiente',
  EN_REVISION: 'en_revision',
  DOCUMENTOS_INCOMPLETOS: 'documentos_incompletos',
  APROBADO: 'aprobado',
  RECHAZADO: 'rechazado',
} as const

export type EstadoEmpresa = typeof ESTADOS_EMPRESA[keyof typeof ESTADOS_EMPRESA]

export const ESTADO_LABELS: Record<EstadoEmpresa, string> = {
  pendiente: 'Pendiente',
  en_revision: 'En Revisión',
  documentos_incompletos: 'Documentos Incompletos',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
}

export const ESTADO_COLORS: Record<EstadoEmpresa, string> = {
  pendiente: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  en_revision: 'bg-blue-100 text-blue-800 border-blue-300',
  documentos_incompletos: 'bg-orange-100 text-orange-800 border-orange-300',
  aprobado: 'bg-green-100 text-green-800 border-green-300',
  rechazado: 'bg-red-100 text-red-800 border-red-300',
}
