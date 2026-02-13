import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { EmpresaPagadora } from '@/lib/types'
import { ESTADO_LABELS } from '@/constants/estados'

export function DashboardSimple() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [empresa, setEmpresa] = useState<EmpresaPagadora | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        navigate('/login')
        return
      }

      setUser(session.user)

      // Verificar si tiene empresa
      const { data: empresaData } = await supabase
        .from('empresas_pagadoras')
        .select('*')
        .eq('usuario_id', session.user.id)
        .single()

      setEmpresa(empresaData)
      setLoading(false)
    }

    loadData()
  }, [navigate])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const handleIniciarOnboarding = () => {
    navigate('/onboarding/datos-empresa')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Portal de Confirming</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-900">Bienvenido</h2>
          <p className="text-gray-600 mt-2">Plataforma de Confirming - Onboarding de Pagadores</p>
        </div>

        {!empresa ? (
          // No tiene empresa - Mostrar opción de iniciar onboarding
          <Card>
            <CardHeader>
              <CardTitle>Completa tu Onboarding</CardTitle>
              <CardDescription>
                Para acceder a la plataforma de confirming, necesitamos algunos datos de tu empresa.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">¿Qué necesitas?</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Información básica de tu empresa (NIT, razón social, etc.)</li>
                  <li>• Datos del representante legal</li>
                  <li>• 6 documentos requeridos (Cámara de Comercio, RUT, etc.)</li>
                </ul>
              </div>
              <Button onClick={handleIniciarOnboarding} size="lg" className="w-full">
                Iniciar Solicitud de Onboarding
              </Button>
            </CardContent>
          </Card>
        ) : (
          // Tiene empresa - Mostrar estado
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{empresa.razon_social || 'Tu Empresa'}</CardTitle>
                  <CardDescription>NIT: {empresa.nit}</CardDescription>
                </div>
                <Badge className="bg-blue-100 text-blue-800">
                  {ESTADO_LABELS[empresa.estado]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-gray-600">
                  Tu solicitud de onboarding está en proceso.
                </p>
                <div className="bg-gray-50 border rounded-lg p-4">
                  <p className="text-sm text-gray-600">
                    <strong>Estado actual:</strong> {ESTADO_LABELS[empresa.estado]}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Creado:</strong> {new Date(empresa.created_at).toLocaleDateString('es-CO')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info adicional */}
        <div className="mt-6 bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-600">
            <strong>Email de contacto:</strong> {user?.email}
          </p>
          <p className="text-sm text-gray-600">
            <strong>ID de usuario:</strong> {user?.id}
          </p>
        </div>
      </div>
    </div>
  )
}
