import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DOCUMENTOS_REQUERIDOS, TAMAÑO_MAX_ARCHIVO, MIME_TYPES_PERMITIDOS } from '@/constants/documentos'
import type { Documento, EmpresaPagadora, TipoDocumento, GenerarUrlSubidaResponse } from '@/lib/types'
import { toast } from 'sonner'
import { Upload, Check, Loader2 } from 'lucide-react'
import { getErrorMessage } from '@/lib/errors'
import { TypeformStep } from '@/components/typeform/TypeformStep'
import { TypeformProgress } from '@/components/typeform/TypeformProgress'
import { TypeformNavigation } from '@/components/typeform/TypeformNavigation'

export function Documentos() {
  const navigate = useNavigate()
  const [empresa, setEmpresa] = useState<EmpresaPagadora | null>(null)
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [uploadingDoc, setUploadingDoc] = useState<TipoDocumento | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentDocStep, setCurrentDocStep] = useState(0)

  const totalDocSteps = DOCUMENTOS_REQUERIDOS.length + 1 // +1 for summary

  const fetchDocumentos = useCallback(async (empresaId: string) => {
    const { data, error } = await supabase
      .from('documentos')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('es_version_actual', true)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setDocumentos(data)
    }
  }, [])

  const fetchEmpresaYDocumentos = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        navigate('/login')
        return
      }

      const { data: empresaData, error: empresaError } = await supabase
        .from('empresas_pagadoras')
        .select('*')
        .eq('usuario_id', session.user.id)
        .maybeSingle()

      if (empresaError) {
        toast.error('No se encontró tu empresa. Por favor completa el formulario primero.')
        navigate('/onboarding/datos-empresa')
        return
      }

      if (!empresaData) {
        toast.error('No se encontró tu empresa. Por favor completa el formulario primero.')
        navigate('/onboarding/datos-empresa')
        return
      }

      setEmpresa(empresaData)
      await fetchDocumentos(empresaData.id)
    } catch (error: unknown) {
      toast.error(`Error al cargar los datos: ${getErrorMessage(error, 'error desconocido')}`)
    } finally {
      setLoading(false)
    }
  }, [fetchDocumentos, navigate])

  useEffect(() => {
    void fetchEmpresaYDocumentos()
  }, [fetchEmpresaYDocumentos])

  const handleUpload = async (file: File, tipoDocumento: TipoDocumento) => {
    if (!empresa) return

    if (file.size > TAMAÑO_MAX_ARCHIVO) {
      toast.error('El archivo supera el tamaño máximo de 10 MB')
      return
    }

    if (!MIME_TYPES_PERMITIDOS.includes(file.type)) {
      toast.error('Solo se permiten archivos PDF, JPG o PNG')
      return
    }

    setUploadingDoc(tipoDocumento)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('No estás autenticado')
        navigate('/login')
        return
      }

      const payload = {
        empresa_id: empresa.id,
        tipo_documento: tipoDocumento,
        nombre_archivo: file.name,
        mime_type: file.type,
        tamano_bytes: file.size,
      }

      let { data, error } = await supabase.functions.invoke<GenerarUrlSubidaResponse>(
        'generar-url-subida',
        {
          body: payload,
        }
      )

      if (!data || error) {
        const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generar-url-subida`
        const maxAttempts = 3

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          })

          const responseData = await response.json().catch(() => null)

          if (response.ok && responseData) {
            data = responseData as GenerarUrlSubidaResponse
            error = null
            break
          }

          const retryable = response.status === 502 || response.status === 503 || response.status === 504
          const message = responseData?.error?.message || `Error HTTP ${response.status}`

          if (!retryable || attempt === maxAttempts) {
            throw new Error(message)
          }

          await new Promise((resolve) => setTimeout(resolve, attempt * 800))
        }
      }

      if (error) {
        toast.error(`Error al generar URL de subida: ${getErrorMessage(error, 'error desconocido')}`)
        return
      }

      if (!data) {
        toast.error('No se recibió URL de subida')
        return
      }

      let uploadResponse: Response
      try {
        uploadResponse = await fetch(data.presigned_url, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
            'x-amz-server-side-encryption': 'AES256',
          },
        })
      } catch (e) {
        const msg = getErrorMessage(e, 'error desconocido')
        toast.error(`Error al subir a S3 (posible CORS): ${msg}`)
        return
      }

      if (!uploadResponse.ok) {
        const details = await uploadResponse.text().catch(() => '')
        toast.error(`Error al subir el archivo a S3 (HTTP ${uploadResponse.status})${details ? `: ${details}` : ''}`)
        return
      }

      toast.success('Documento subido correctamente')
      await fetchDocumentos(empresa.id)
    } catch (error: unknown) {
      toast.error(`Error al subir el documento: ${getErrorMessage(error, 'error desconocido')}`)
    } finally {
      setUploadingDoc(null)
    }
  }

  const handleFileSelect = (tipoDocumento: TipoDocumento) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = DOCUMENTOS_REQUERIDOS.find(d => d.tipo === tipoDocumento)?.formatos.join(',') || ''
    input.onchange = (event: Event) => {
      const target = event.target as HTMLInputElement
      const file = target.files?.[0]
      if (file) {
        void handleUpload(file, tipoDocumento)
      }
    }
    input.click()
  }

  const handleEnviarSolicitud = () => {
    navigate('/onboarding/confirmacion')
  }

  const documentosSubidos = DOCUMENTOS_REQUERIDOS.filter((docReq) =>
    documentos.some((doc) => doc.tipo_documento === docReq.tipo)
  )

  const todoListo = documentosSubidos.length === DOCUMENTOS_REQUERIDOS.length

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <TypeformProgress current={currentDocStep + 1} total={totalDocSteps} />

      <AnimatePresence mode="wait">
        {currentDocStep < DOCUMENTOS_REQUERIDOS.length ? (() => {
          const docReq = DOCUMENTOS_REQUERIDOS[currentDocStep]
          const docSubido = documentos.find((d) => d.tipo_documento === docReq.tipo)
          const isUploading = uploadingDoc === docReq.tipo

          return (
            <TypeformStep key={docReq.tipo} stepNumber={currentDocStep + 1} totalSteps={DOCUMENTOS_REQUERIDOS.length}>
              <h2 className="text-3xl md:text-4xl font-bold mb-3 text-foreground">
                {docReq.nombre}
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                {docReq.descripcion}
              </p>

              <div
                className="border-2 border-dashed border-border rounded-2xl p-12 text-center
                           hover:border-primary/50 transition-all duration-300 cursor-pointer
                           hover:bg-primary/[0.05]"
                onClick={() => !isUploading && handleFileSelect(docReq.tipo)}
              >
                {docSubido ? (
                  <div className="space-y-3">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <Check className="h-8 w-8 text-primary" />
                    </div>
                    <p className="text-lg font-medium text-foreground">{docSubido.nombre_original}</p>
                    <p className="text-sm text-muted-foreground">
                      {(docSubido.tamano_bytes / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <Button variant="outline" size="sm" type="button">
                      Reemplazar documento
                    </Button>
                  </div>
                ) : isUploading ? (
                  <div className="space-y-3">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                    <p className="text-lg text-muted-foreground">Subiendo documento...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <Upload className="h-8 w-8 text-primary/60" />
                    </div>
                    <p className="text-lg text-foreground">Haz clic para seleccionar un archivo</p>
                    <p className="text-sm text-muted-foreground">
                      {docReq.formatos.map(f => f.split('/')[1]?.toUpperCase()).join(', ')} &mdash; max 10 MB
                    </p>
                  </div>
                )}
              </div>
            </TypeformStep>
          )
        })() : (
          <TypeformStep key="summary">
            <h2 className="text-3xl md:text-4xl font-bold mb-2 text-foreground">
              Resumen de documentos
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              {todoListo
                ? 'Todos los documentos han sido subidos. Puedes enviar tu solicitud.'
                : `Faltan ${DOCUMENTOS_REQUERIDOS.length - documentosSubidos.length} documento(s) por subir.`}
            </p>

            <div className="space-y-1">
              {DOCUMENTOS_REQUERIDOS.map((docReq, index) => {
                const uploaded = documentos.some((d) => d.tipo_documento === docReq.tipo)
                return (
                  <div
                    key={docReq.tipo}
                    className="flex items-center justify-between py-4 border-b border-border cursor-pointer hover:bg-secondary/50 px-2 rounded-lg transition-colors"
                    onClick={() => !uploaded && setCurrentDocStep(index)}
                  >
                    <span className="text-lg text-foreground">{docReq.nombre}</span>
                    {uploaded ? (
                      <Badge className="bg-primary text-primary-foreground">
                        <Check className="h-3 w-3 mr-1" />
                        Subido
                      </Badge>
                    ) : (
                      <span className="text-sm text-destructive font-medium">Pendiente</span>
                    )}
                  </div>
                )
              })}
            </div>
          </TypeformStep>
        )}
      </AnimatePresence>

      <TypeformNavigation
        onPrev={() => setCurrentDocStep((s) => Math.max(0, s - 1))}
        onNext={() => setCurrentDocStep((s) => Math.min(totalDocSteps - 1, s + 1))}
        canGoPrev={currentDocStep > 0}
        canGoNext={currentDocStep < totalDocSteps - 1}
        showSubmit={currentDocStep === totalDocSteps - 1}
        submitLabel="Enviar solicitud"
        loading={false}
        onSubmitClick={todoListo ? handleEnviarSolicitud : undefined}
      />
    </div>
  )
}
