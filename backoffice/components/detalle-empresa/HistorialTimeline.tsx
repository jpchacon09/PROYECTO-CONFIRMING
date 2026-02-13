import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { HistorialEstado } from '@/lib/types'
import { ESTADO_LABELS } from '@/constants/estados'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Clock, ArrowRight } from 'lucide-react'

interface HistorialTimelineProps {
  historial: HistorialEstado[]
}

export function HistorialTimeline({ historial }: HistorialTimelineProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Historial de Estados ({historial.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {historial.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay historial de cambios de estado
          </p>
        ) : (
          <div className="space-y-4">
            {historial.map((item, index) => {
              const isLast = index === historial.length - 1

              return (
                <div key={item.id} className="relative">
                  {/* Línea conectora */}
                  {!isLast && (
                    <div className="absolute left-2 top-8 bottom-0 w-px bg-border" />
                  )}

                  <div className="flex gap-3">
                    {/* Icono */}
                    <div className={`
                      relative flex-shrink-0 w-4 h-4 mt-1 rounded-full border-2
                      ${index === 0 ? 'bg-primary border-primary' : 'bg-card border-border'}
                    `} />

                    {/* Contenido */}
                    <div className="flex-1 pb-6">
                      <div className="flex items-center gap-2 mb-1">
                        {item.estado_anterior && (
                          <>
                            <span className="text-sm font-medium text-muted-foreground">
                              {ESTADO_LABELS[item.estado_anterior as keyof typeof ESTADO_LABELS] || item.estado_anterior}
                            </span>
                            <ArrowRight className="h-4 w-4 text-muted-foreground/70" />
                          </>
                        )}
                        <span className={`text-sm font-semibold ${
                          index === 0 ? 'text-primary' : 'text-foreground'
                        }`}>
                          {ESTADO_LABELS[item.estado_nuevo as keyof typeof ESTADO_LABELS] || item.estado_nuevo}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground mb-2">
                        {format(new Date(item.created_at), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
                      </p>

                      {item.motivo && (
                        <p className="text-sm text-foreground/80 bg-secondary rounded px-3 py-2 border">
                          {item.motivo}
                        </p>
                      )}

                      {item.cambiado_por && (
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          Por: Admin
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
