'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { EmpresaPagadora } from '@/lib/types'
import { CheckCircle, XCircle, FileWarning, Eye } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

interface AccionesAdminProps {
  empresa: EmpresaPagadora
}

export function AccionesAdmin({ empresa }: AccionesAdminProps) {
  const router = useRouter()
  const [showDialog, setShowDialog] = useState(false)
  const [accionSeleccionada, setAccionSeleccionada] = useState<{
    estado: string
    titulo: string
    color: string
  } | null>(null)
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)

  const acciones = [
    {
      estado: 'aprobado',
      titulo: 'Aprobar Onboarding',
      color: 'bg-green-600 hover:bg-green-700',
      icon: CheckCircle,
      disabled: empresa.estado === 'aprobado',
      requiresMotivo: false
    },
    {
      estado: 'rechazado',
      titulo: 'Rechazar Empresa',
      color: 'bg-red-600 hover:bg-red-700',
      icon: XCircle,
      disabled: empresa.estado === 'rechazado',
      requiresMotivo: true
    },
    {
      estado: 'documentos_incompletos',
      titulo: 'Marcar Documentos Incompletos',
      color: 'bg-orange-600 hover:bg-orange-700',
      icon: FileWarning,
      disabled: empresa.estado === 'documentos_incompletos',
      requiresMotivo: true
    },
    {
      estado: 'en_revision',
      titulo: 'Marcar En Revisión',
      color: 'bg-blue-600 hover:bg-blue-700',
      icon: Eye,
      disabled: empresa.estado === 'en_revision',
      requiresMotivo: false
    },
  ]

  const handleAccion = (accion: typeof acciones[0]) => {
    setAccionSeleccionada({
      estado: accion.estado,
      titulo: accion.titulo,
      color: accion.color
    })
    setMotivo('')
    setShowDialog(true)
  }

  const handleConfirmar = async () => {
    if (!accionSeleccionada) return

    try {
      setLoading(true)

      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) {
        throw new Error('Sesion no encontrada. Vuelve a iniciar sesion.')
      }

      const response = await fetch(`/api/admin/empresas/${empresa.id}/estado`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          nuevo_estado: accionSeleccionada.estado,
          motivo: motivo.trim() || undefined
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Error al cambiar estado')
      }

      setShowDialog(false)
      setAccionSeleccionada(null)
      setMotivo('')
      router.refresh() // Recargar la página para mostrar el nuevo estado
    } catch (error) {
      console.error('Error al cambiar estado:', error)
      alert(error instanceof Error ? error.message : 'Error al cambiar estado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">Acciones de Administrador</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Cambia el estado de esta empresa en el proceso de onboarding
              </p>
            </div>
            <div className="flex gap-2">
              {acciones.map((accion) => (
                <Button
                  key={accion.estado}
                  onClick={() => handleAccion(accion)}
                  disabled={accion.disabled}
                  className={accion.color + ' text-white'}
                  size="sm"
                >
                  <accion.icon className="h-4 w-4 mr-2" />
                  {accion.titulo}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de confirmación */}
      {showDialog && accionSeleccionada && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-lg shadow-xl w-full max-w-md border border-border">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                {accionSeleccionada.titulo}
              </h3>

              <p className="text-sm text-muted-foreground mb-4">
                ¿Estás seguro de que deseas cambiar el estado de la empresa{' '}
                <strong>{empresa.razon_social}</strong> a{' '}
                <strong>{accionSeleccionada.estado.replace(/_/g, ' ')}</strong>?
              </p>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="motivo">
                    Motivo {accionSeleccionada.estado === 'aprobado' ? '(opcional)' : '(requerido)'}
                  </Label>
                  <Textarea
                    id="motivo"
                    placeholder="Explica el motivo del cambio de estado..."
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    rows={4}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDialog(false)
                    setAccionSeleccionada(null)
                    setMotivo('')
                  }}
                  disabled={loading}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmar}
                  disabled={loading || (accionSeleccionada.estado !== 'aprobado' && !motivo.trim())}
                  className={accionSeleccionada.color + ' text-white flex-1'}
                >
                  {loading ? 'Guardando...' : 'Confirmar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
