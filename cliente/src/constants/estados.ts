import type { EstadoEmpresa } from '@/lib/types'

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

export const ESTADO_DESCRIPTIONS: Record<EstadoEmpresa, string> = {
  pendiente: 'Tu solicitud ha sido recibida y está en espera de revisión por nuestro equipo.',
  en_revision: 'Nuestro equipo está revisando tu información y documentos.',
  documentos_incompletos: 'Necesitamos que actualices algunos documentos para continuar con la revisión.',
  aprobado: '¡Felicitaciones! Tu solicitud ha sido aprobada. Ya puedes acceder a la plataforma.',
  rechazado: 'Lo sentimos, tu solicitud no pudo ser aprobada en este momento.',
}

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
  'Vichada',
]
