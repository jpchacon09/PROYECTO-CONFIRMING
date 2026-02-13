'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase/client'
import { ShieldCheck, ShieldAlert, ShieldQuestion, RefreshCw, Clock, AlertTriangle } from 'lucide-react'

type SarlaftRecord = {
  id: string
  scope: string
  provider_status: number | null
  created_at: string
  resultado: unknown
}

/** Intenta interpretar el resultado SARLAFT y devuelve un resumen legible */
function interpretResult(record: SarlaftRecord | null): {
  status: 'limpio' | 'alerta' | 'error' | 'pendiente'
  title: string
  details: string[]
} {
  if (!record) {
    return { status: 'pendiente', title: 'Sin validación', details: ['Aún no se ha ejecutado esta consulta.'] }
  }

  const httpOk = record.provider_status !== null && record.provider_status >= 200 && record.provider_status < 300

  if (!httpOk) {
    return {
      status: 'error',
      title: 'Error en la consulta',
      details: [
        `El servicio respondió con código ${record.provider_status || 'desconocido'}.`,
        'Intenta revalidar o contacta soporte si persiste.'
      ]
    }
  }

  const res = record.resultado as Record<string, unknown> | null
  if (!res || typeof res !== 'object') {
    return { status: 'limpio', title: 'Consulta realizada', details: ['No se encontraron coincidencias en listas restrictivas.'] }
  }

  // Try to detect common response patterns
  const found = extractMatches(res)

  if (found.length > 0) {
    return {
      status: 'alerta',
      title: 'Coincidencias encontradas',
      details: found
    }
  }

  return {
    status: 'limpio',
    title: 'Sin coincidencias',
    details: ['No se encontraron registros en listas restrictivas ni bases de datos de riesgo.']
  }
}

/** Extract meaningful match info from any shape of resultado */
function extractMatches(obj: Record<string, unknown>): string[] {
  const matches: string[] = []

  // Check for nested arrays of results (common pattern)
  for (const key of Object.keys(obj)) {
    const val = obj[key]

    // If it's an array with items, those are usually matches
    if (Array.isArray(val) && val.length > 0) {
      for (const item of val) {
        if (typeof item === 'object' && item !== null) {
          const rec = item as Record<string, unknown>
          const source = rec.source || rec.fuente || rec.lista || rec.list || rec.database || key
          const name = rec.name || rec.nombre || rec.matched_name || ''
          const detail = rec.detail || rec.detalle || rec.description || rec.motivo || ''
          matches.push(`${source}${name ? `: ${name}` : ''}${detail ? ` — ${detail}` : ''}`)
        } else if (typeof item === 'string') {
          matches.push(item)
        }
      }
    }

    // Boolean flags for matches
    if (typeof val === 'boolean' && val && /match|found|hit|alert/i.test(key)) {
      matches.push(`${key}: positivo`)
    }

    // Nested object with a "results" or "matches" array
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      const nested = val as Record<string, unknown>
      if (Array.isArray(nested.results) && nested.results.length > 0) {
        matches.push(...extractMatches(nested))
      }
      if (Array.isArray(nested.matches) && nested.matches.length > 0) {
        matches.push(...extractMatches(nested))
      }
    }
  }

  return matches
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

const statusConfig = {
  limpio: {
    icon: ShieldCheck,
    bg: 'bg-primary/10',
    border: 'border-primary/30',
    iconColor: 'text-primary',
    titleColor: 'text-primary',
  },
  alerta: {
    icon: ShieldAlert,
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    iconColor: 'text-yellow-400',
    titleColor: 'text-yellow-400',
  },
  error: {
    icon: AlertTriangle,
    bg: 'bg-destructive/10',
    border: 'border-destructive/30',
    iconColor: 'text-destructive',
    titleColor: 'text-destructive',
  },
  pendiente: {
    icon: ShieldQuestion,
    bg: 'bg-muted',
    border: 'border-border',
    iconColor: 'text-muted-foreground',
    titleColor: 'text-muted-foreground',
  },
}

function ResultCard({ label, record }: { label: string; record: SarlaftRecord | null }) {
  const result = interpretResult(record)
  const config = statusConfig[result.status]
  const Icon = config.icon

  return (
    <div className={`rounded-lg border ${config.border} ${config.bg} p-4 space-y-3`}>
      <div className="flex items-center gap-3">
        <div className={`flex items-center justify-center w-10 h-10 rounded-full ${config.bg} ${config.iconColor}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground">{label}</div>
          <div className={`text-sm font-semibold ${config.titleColor}`}>{result.title}</div>
        </div>
      </div>

      <div className="space-y-1">
        {result.details.map((detail, i) => (
          <p key={i} className="text-sm text-muted-foreground leading-relaxed">{detail}</p>
        ))}
      </div>

      {record && (
        <div className="flex items-center gap-1.5 pt-1">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {formatDate(record.created_at)}
          </span>
        </div>
      )}
    </div>
  )
}

export function SarlaftPanel(props: {
  empresaId: string
  nit: string
  razonSocial: string
  representanteNombre: string
  representanteTipoDocumento?: string | null
  representanteDocumento: string
  validaciones: SarlaftRecord[]
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const lastEmpresa = props.validaciones.find((v) => v.scope === 'empresa') ?? null
  const lastRep = props.validaciones.find((v) => v.scope === 'representante') ?? null

  const nitBase = (props.nit || '').replace(/\D/g, '').slice(0, 9)
  const repTipo = (props.representanteTipoDocumento || 'CC').toUpperCase() === 'CE' ? 'CE' : 'CC'

  const runCheck = async (scope: 'empresa' | 'representante', force_refresh: boolean) => {
    try {
      setLoading(true)

      const body =
        scope === 'empresa'
          ? {
              empresa_id: props.empresaId,
              scope: 'empresa',
              nombres: props.razonSocial,
              documento: nitBase,
              tipo_documento: 'NIT',
              user_id: 'agentrobust',
              ip_address: '',
              force_refresh,
            }
          : {
              empresa_id: props.empresaId,
              scope: 'representante',
              nombres: props.representanteNombre,
              documento: props.representanteDocumento,
              tipo_documento: repTipo,
              user_id: 'agentrobust',
              ip_address: '',
              force_refresh,
            }

      const { data, error } = await supabase.functions.invoke('validar-sarlaft', { body })
      if (error) throw error

      const result = data as Record<string, unknown> | null
      if (!result?.success) {
        const errObj = result?.error as Record<string, unknown> | undefined
        throw new Error((errObj?.message as string) || 'Respuesta inesperada de SARLAFT')
      }

      router.refresh()
    } catch (e) {
      console.error('Sarlaft error:', e)
      alert(e instanceof Error ? e.message : 'Error validando SARLAFT')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Validación SARLAFT
        </CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void runCheck('empresa', true)}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Validar NIT
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void runCheck('representante', true)}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Validar {repTipo}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <ResultCard
            label={`Empresa — NIT ${nitBase || props.nit}`}
            record={lastEmpresa}
          />
          <ResultCard
            label={`Representante — ${repTipo} ${props.representanteDocumento}`}
            record={lastRep}
          />
        </div>
      </CardContent>
    </Card>
  )
}
