import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmpresaPagadora, Documento, HistorialEstado } from '@/lib/types'
import { ESTADO_LABELS, ESTADO_COLORS, ESTADO_DESCRIPTIONS } from '@/constants/estados'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Loader2, Building2, FileText, History, LogOut } from 'lucide-react'
import { toast } from 'sonner'

export function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [empresa, setEmpresa] = useState<EmpresaPagadora | null>(null)
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [historial, setHistorial] = useState<HistorialEstado[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchDatos()
    }
  }, [user])

  const fetchDatos = async () => {
    if (!user) return

    try {
      // Obtener empresa
      const { data: empresaData, error: empresaError } = await supabase
        .from('empresas_pagadoras')
        .select('*')
        .eq('usuario_id', user.id)
        .single()

      if (empresaError || !empresaData) {
        toast.error('No se encontró tu empresa. Por favor completa el formulario.')
        navigate('/onboarding/datos-empresa')
        return
      }

      setEmpresa(empresaData)

      // Obtener documentos
      const { data: docsData } = await supabase
        .from('documentos')
        .select('*')
        .eq('empresa_id', empresaData.id)
        .eq('es_version_actual', true)
        .order('created_at', { ascending: false })

      if (docsData) setDocumentos(docsData)

      // Obtener historial
      const { data: historialData } = await supabase
        .from('historial_estados')
        .select('*')
        .eq('empresa_id', empresaData.id)
        .order('created_at', { ascending: false })

      if (historialData) setHistorial(historialData)
    } catch (error: any) {
      toast.error('Error al cargar los datos: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!empresa) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Portal de Confirming</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Estado principal */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">{empresa.razon_social}</CardTitle>
                <CardDescription>NIT: {empresa.nit}</CardDescription>
              </div>
              <Badge className={ESTADO_COLORS[empresa.estado]}>
                {ESTADO_LABELS[empresa.estado]}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">{ESTADO_DESCRIPTIONS[empresa.estado]}</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Fecha de solicitud:</span>
                <p className="font-medium">
                  {format(new Date(empresa.created_at), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Última actualización:</span>
                <p className="font-medium">
                  {format(new Date(empresa.updated_at), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                </p>
              </div>
            </div>

            {empresa.estado === 'documentos_incompletos' && (
              <div className="mt-4">
                <Button onClick={() => navigate('/onboarding/documentos')}>
                  Actualizar documentos
                </Button>
              </div>
            )}

            {empresa.estado === 'aprobado' && (
              <div className="mt-4">
                <Button>Acceder a la plataforma</Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Documentos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documentos Subidos ({documentos.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {documentos.length === 0 ? (
                <p className="text-sm text-gray-500">No hay documentos subidos</p>
              ) : (
                <div className="space-y-3">
                  {documentos.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">{doc.nombre_original}</p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(doc.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                        </p>
                      </div>
                      <Badge variant={doc.extraccion_completa ? 'default' : 'secondary'}>
                        {doc.extraccion_completa ? 'Procesado' : 'Procesando...'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Historial */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Historial de Estados ({historial.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {historial.length === 0 ? (
                <p className="text-sm text-gray-500">No hay cambios de estado</p>
              ) : (
                <div className="space-y-4">
                  {historial.map((item, index) => (
                    <div key={item.id} className="relative pl-6">
                      {index < historial.length - 1 && (
                        <div className="absolute left-2 top-6 bottom-0 w-px bg-gray-300" />
                      )}
                      <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-primary" />
                      <div>
                        <p className="text-sm font-medium">
                          {item.estado_anterior ? (
                            <>
                              {ESTADO_LABELS[item.estado_anterior as any]} →{' '}
                              {ESTADO_LABELS[item.estado_nuevo as any]}
                            </>
                          ) : (
                            <>Creado como {ESTADO_LABELS[item.estado_nuevo as any]}</>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(item.created_at), "dd/MM/yyyy 'a las' HH:mm", {
                            locale: es,
                          })}
                        </p>
                        {item.motivo && (
                          <p className="text-xs text-gray-600 mt-1 italic">
                            Motivo: {item.motivo}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
