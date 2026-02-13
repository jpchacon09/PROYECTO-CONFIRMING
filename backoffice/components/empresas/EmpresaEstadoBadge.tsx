import { Badge } from '@/components/ui/badge'
import { ESTADO_LABELS, ESTADO_COLORS, type EstadoEmpresa } from '@/constants/estados'
import { cn } from '@/lib/utils/cn'

interface EmpresaEstadoBadgeProps {
  estado: EstadoEmpresa
  className?: string
}

export function EmpresaEstadoBadge({ estado, className }: EmpresaEstadoBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium',
        ESTADO_COLORS[estado],
        className
      )}
    >
      {ESTADO_LABELS[estado]}
    </Badge>
  )
}
