import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmpresasTable } from '@/components/empresas/EmpresasTable'
import { Building2, Calendar, Clock, CheckCircle, XCircle } from 'lucide-react'
import { ESTADOS_EMPRESA } from '@/constants/estados'
import type { EmpresaPagadora } from '@/lib/types'

export const dynamic = 'force-dynamic'

async function getEmpresas(): Promise<EmpresaPagadora[]> {
  const supabase = await createServerSupabaseClient()

  const { data: empresas, error } = await supabase
    .from('empresas_pagadoras')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching empresas:', error)
    return []
  }

  return empresas || []
}

export default async function DashboardPage() {
  const empresas = await getEmpresas()

  // Calcular estadísticas
  const stats = {
    total: empresas.length,
    pendientes: empresas.filter(e => e.estado === 'pendiente').length,
    en_revision: empresas.filter(e => e.estado === 'en_revision').length,
    documentos_incompletos: empresas.filter(e => e.estado === 'documentos_incompletos').length,
    aprobadas: empresas.filter(e => e.estado === 'aprobado').length,
    rechazadas: empresas.filter(e => e.estado === 'rechazado').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Gestión de empresas pagadoras en onboarding</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">Empresas registradas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pendientes}</div>
            <p className="text-xs text-muted-foreground mt-1">Esperando revisión</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Revisión</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.en_revision}</div>
            <p className="text-xs text-muted-foreground mt-1">En proceso</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Incompletos</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.documentos_incompletos}</div>
            <p className="text-xs text-muted-foreground mt-1">Faltan docs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprobadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.aprobadas}</div>
            <p className="text-xs text-muted-foreground mt-1">Onboarding completo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rechazadas</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rechazadas}</div>
            <p className="text-xs text-muted-foreground mt-1">No aprobadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de empresas */}
      <EmpresasTable empresas={empresas} />

      {/* Info de conexión */}
      {empresas.length === 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <p className="text-sm text-yellow-900">
              <span className="font-semibold">No hay empresas registradas.</span>
              {' '}La base de datos está vacía. Puedes crear empresas de prueba desde el onboarding o insertarlas manualmente en Supabase.
            </p>
          </CardContent>
        </Card>
      )}

      {empresas.length > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <p className="text-sm text-green-900">
              <span className="font-semibold">✅ Conectado a Supabase!</span>
              {' '}Mostrando {empresas.length} empresa{empresas.length !== 1 ? 's' : ''} desde la base de datos real.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
