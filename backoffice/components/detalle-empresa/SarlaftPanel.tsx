'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase/client'

type SarlaftRecord = {
  id: string
  scope: string
  provider_status: number | null
  created_at: string
  resultado: unknown
}

function safeStringify(value: unknown, maxLen = 2000) {
  try {
    const s = JSON.stringify(value, null, 2)
    if (s.length <= maxLen) return s
    return s.slice(0, maxLen) + '\n...'
  } catch {
    return String(value)
  }
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

      if (!(data as any)?.success) {
        throw new Error((data as any)?.error?.message || 'Respuesta inesperada de SARLAFT')
      }

      router.refresh()
      alert('Validacion SARLAFT ejecutada. Se actualizo el panel.')
    } catch (e) {
      console.error('Sarlaft error:', e)
      alert(e instanceof Error ? e.message : 'Error validando SARLAFT')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-purple-200 bg-purple-50">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>SARLAFT</CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void runCheck('empresa', true)}
          >
            Revalidar NIT
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void runCheck('representante', true)}
          >
            Revalidar CC/CE
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-md border bg-white p-3">
            <div className="text-sm font-medium text-gray-900">Empresa (NIT)</div>
            <div className="text-xs text-gray-600 mt-1">
              Ultima: {lastEmpresa ? new Date(lastEmpresa.created_at).toLocaleString() : 'sin validacion'}
              {lastEmpresa?.provider_status ? ` | HTTP ${lastEmpresa.provider_status}` : ''}
            </div>
            {lastEmpresa && (
              <pre className="mt-2 max-h-56 overflow-auto rounded bg-gray-50 p-2 text-xs">
                {safeStringify(lastEmpresa.resultado)}
              </pre>
            )}
          </div>

          <div className="rounded-md border bg-white p-3">
            <div className="text-sm font-medium text-gray-900">Representante (CC/CE)</div>
            <div className="text-xs text-gray-600 mt-1">
              Ultima: {lastRep ? new Date(lastRep.created_at).toLocaleString() : 'sin validacion'}
              {lastRep?.provider_status ? ` | HTTP ${lastRep.provider_status}` : ''}
            </div>
            {lastRep && (
              <pre className="mt-2 max-h-56 overflow-auto rounded bg-gray-50 p-2 text-xs">
                {safeStringify(lastRep.resultado)}
              </pre>
            )}
          </div>
        </div>

        <div className="text-xs text-gray-600">
          Nota: la validacion se ejecuta server-side via Supabase Edge Function para evitar CORS.
        </div>
      </CardContent>
    </Card>
  )
}
