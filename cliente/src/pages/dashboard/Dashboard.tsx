import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { EmpresaPagadora, Documento, HistorialEstado } from '@/lib/types'
import { ESTADO_LABELS, ESTADO_COLORS, ESTADO_DESCRIPTIONS } from '@/constants/estados'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Loader2, Building2, FileText, History, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
}

export function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [empresa, setEmpresa] = useState<EmpresaPagadora | null>(null)
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [historial, setHistorial] = useState<HistorialEstado[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDatos = useCallback(async () => {
    if (!user) return

    try {
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

      const { data: docsData } = await supabase
        .from('documentos')
        .select('*')
        .eq('empresa_id', empresaData.id)
        .eq('es_version_actual', true)
        .order('created_at', { ascending: false })

      if (docsData) setDocumentos(docsData)

      const { data: historialData } = await supabase
        .from('historial_estados')
        .select('*')
        .eq('empresa_id', empresaData.id)
        .order('created_at', { ascending: false })

      if (historialData) setHistorial(historialData)
    } catch (error: unknown) {
      toast.error(`Error al cargar los datos: ${getErrorMessage(error, 'error desconocido')}`)
    } finally {
      setLoading(false)
    }
  }, [navigate, user])

  useEffect(() => {
    if (user) {
      void fetchDatos()
    }
  }, [fetchDatos, user])

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background/80 backdrop-blur-sm border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-lg font-semibold text-foreground">Portal de Confirming</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Estado principal */}
        <motion.div
          {...fadeInUp}
          transition={{ duration: 0.5 }}
        >
          <Card className="mb-8 overflow-hidden">
            <div className="h-1 bg-primary" />
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">{empresa.razon_social}</CardTitle>
                  <CardDescription className="mt-1">NIT: {empresa.nit}</CardDescription>
                </div>
                <Badge className={ESTADO_COLORS[empresa.estado]}>
                  {ESTADO_LABELS[empresa.estado]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-6">{ESTADO_DESCRIPTIONS[empresa.estado]}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                <div>
                  <span className="text-muted-foreground">Fecha de solicitud</span>
                  <p className="font-medium text-foreground mt-0.5">
                    {format(new Date(empresa.created_at), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Última actualización</span>
                  <p className="font-medium text-foreground mt-0.5">
                    {format(new Date(empresa.updated_at), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                  </p>
                </div>
              </div>

              {empresa.estado === 'documentos_incompletos' && (
                <div className="mt-6">
                  <Button onClick={() => navigate('/onboarding/documentos')} size="typeform">
                    Actualizar documentos
                  </Button>
                </div>
              )}

              {empresa.estado === 'aprobado' && (
                <div className="mt-6">
                  <Button size="typeform">Acceder a la plataforma</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Documentos */}
          <motion.div
            {...fadeInUp}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className="hover:shadow-md transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-primary" />
                  Documentos Subidos ({documentos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {documentos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay documentos subidos</p>
                ) : (
                  <div className="space-y-3">
                    {documentos.map((doc, index) => (
                      <motion.div
                        key={doc.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-xl"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + index * 0.05 }}
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{doc.nombre_original}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(doc.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                          </p>
                        </div>
                        <Badge variant={doc.extraccion_completa ? 'default' : 'secondary'}>
                          {doc.extraccion_completa ? 'Procesado' : 'Procesando...'}
                        </Badge>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Historial */}
          <motion.div
            {...fadeInUp}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="hover:shadow-md transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <History className="h-5 w-5 text-primary" />
                  Historial de Estados ({historial.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {historial.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay cambios de estado</p>
                ) : (
                  <div className="space-y-4">
                    {historial.map((item, index) => (
                      <motion.div
                        key={item.id}
                        className="relative pl-6"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + index * 0.05 }}
                      >
                        {index < historial.length - 1 && (
                          <div className="absolute left-[7px] top-6 bottom-0 w-px bg-border" />
                        )}
                        <div className="absolute left-0 top-1.5 w-[14px] h-[14px] rounded-full bg-primary border-2 border-background" />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {item.estado_anterior ? (
                              <>
                                {ESTADO_LABELS[item.estado_anterior]} →{' '}
                                {ESTADO_LABELS[item.estado_nuevo]}
                              </>
                            ) : (
                              <>Creado como {ESTADO_LABELS[item.estado_nuevo]}</>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(item.created_at), "dd/MM/yyyy 'a las' HH:mm", {
                              locale: es,
                            })}
                          </p>
                          {item.motivo && (
                            <p className="text-xs text-muted-foreground mt-1 italic">
                              Motivo: {item.motivo}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
