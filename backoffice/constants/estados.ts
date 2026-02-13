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
  pendiente: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  en_revision: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  documentos_incompletos: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  aprobado: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  rechazado: 'bg-red-500/10 text-red-400 border-red-500/30',
}
