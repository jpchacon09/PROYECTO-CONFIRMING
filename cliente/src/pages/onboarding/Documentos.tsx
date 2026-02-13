import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { DOCUMENTOS_REQUERIDOS, TAMAÑO_MAX_ARCHIVO, MIME_TYPES_PERMITIDOS } from '@/constants/documentos'
import type { Documento, EmpresaPagadora, TipoDocumento, GenerarUrlSubidaResponse } from '@/lib/types'
import { toast } from 'sonner'
import { Upload, Check, FileText, Loader2 } from 'lucide-react'
import { getErrorMessage } from '@/lib/errors'

export function Documentos() {
  const navigate = useNavigate()
  const [empresa, setEmpresa] = useState<EmpresaPagadora | null>(null)
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [uploadingDoc, setUploadingDoc] = useState<TipoDocumento | null>(null)
  const [loading, setLoading] = useState(true)

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
      // Obtener sesión
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        navigate('/login')
        return
      }

      // Obtener empresa
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

      // Obtener documentos
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

    // Validar tamaño
    if (file.size > TAMAÑO_MAX_ARCHIVO) {
      toast.error('El archivo supera el tamaño máximo de 10 MB')
      return
    }

    // Validar tipo MIME
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

      // 1. Llamar Edge Function para obtener presigned URL
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

      // Fallback con fetch directo para manejar mejor errores transitorios de gateway/CORS
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

      // 2. Subir a S3 usando presigned URL
      const uploadResponse = await fetch(data.presigned_url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      })

      if (!uploadResponse.ok) {
        toast.error('Error al subir el archivo a S3')
        return
      }

      // 3. Éxito
      toast.success('Documento subido correctamente')

      // 4. Refrescar lista de documentos
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
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Documentos requeridos</h1>
          <p className="text-gray-600 mt-2">Paso 2 de 2 - Sube los documentos de tu empresa</p>
          <div className="mt-4 h-2 bg-gray-200 rounded-full">
            <div className="h-2 bg-primary rounded-full w-full" />
          </div>
        </div>

        <div className="mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Documentos subidos</p>
                  <p className="text-2xl font-bold">
                    {documentosSubidos.length} / {DOCUMENTOS_REQUERIDOS.length}
                  </p>
                </div>
                {todoListo && (
                  <Badge className="bg-green-500 text-white">
                    <Check className="h-4 w-4 mr-1" />
                    Completo
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {DOCUMENTOS_REQUERIDOS.map((docReq) => {
            const docSubido = documentos.find((d) => d.tipo_documento === docReq.tipo)
            const isUploading = uploadingDoc === docReq.tipo

            return (
              <Card key={docReq.tipo} className="relative">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-primary mt-1" />
                      <div>
                        <CardTitle className="text-lg">{docReq.nombre}</CardTitle>
                        <CardDescription className="text-sm mt-1">
                          {docReq.descripcion}
                        </CardDescription>
                      </div>
                    </div>
                    {docSubido && (
                      <Badge className="bg-green-500 text-white">
                        <Check className="h-3 w-3" />
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {docSubido ? (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">
                        <strong>Archivo:</strong> {docSubido.nombre_original}
                      </p>
                      <p className="text-sm text-gray-600">
                        <strong>Tamaño:</strong> {(docSubido.tamano_bytes / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleFileSelect(docReq.tipo)}
                        disabled={isUploading}
                        className="w-full"
                      >
                        Reemplazar documento
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleFileSelect(docReq.tipo)}
                      disabled={isUploading}
                      className="w-full"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Subiendo...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Subir documento
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="mt-8">
          <Button
            onClick={handleEnviarSolicitud}
            disabled={!todoListo}
            size="lg"
            className="w-full"
          >
            Enviar solicitud
          </Button>
          {!todoListo && (
            <p className="text-sm text-center text-gray-500 mt-2">
              Debes subir todos los documentos para continuar
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
