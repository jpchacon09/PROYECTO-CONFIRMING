'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { Documento } from '@/lib/types'
import { X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DocumentViewerProps {
  documento: Documento
  onClose: () => void
}

export function DocumentViewer({ documento, onClose }: DocumentViewerProps) {
  const [presignedUrl, setPresignedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPresignedUrl() {
      try {
        setLoading(true)
        setError(null)

        // Llamar a la Edge Function para obtener presigned URL
        const { data, error: funcError } = await supabase.functions.invoke(
          'obtener-url-documento',
          {
            body: { documento_id: documento.id }
          }
        )

        if (funcError) {
          throw funcError
        }

        if (data && data.presigned_url) {
          setPresignedUrl(data.presigned_url)
        } else {
          throw new Error('No se recibió URL del documento')
        }
      } catch (err) {
        console.error('Error fetching presigned URL:', err)
        setError('Error al cargar el documento')
      } finally {
        setLoading(false)
      }
    }

    fetchPresignedUrl()
  }, [documento.id])

  // Cerrar con ESC
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h3 className="font-semibold text-lg">{documento.nombre_original}</h3>
            <p className="text-sm text-gray-500">
              {(documento.tamano_bytes / 1024).toFixed(0)} KB
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="ml-3 text-gray-600">Cargando documento...</p>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-red-600 font-medium">{error}</p>
                <Button variant="outline" onClick={onClose} className="mt-4">
                  Cerrar
                </Button>
              </div>
            </div>
          )}

          {!loading && !error && presignedUrl && (
            <>
              {documento.mime_type === 'application/pdf' ? (
                <iframe
                  src={`${presignedUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                  className="w-full h-full border-0"
                  title={documento.nombre_original}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <img
                    src={presignedUrl}
                    alt={documento.nombre_original}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex items-center justify-between bg-gray-50">
          <div className="text-sm text-gray-500">
            Presiona <kbd className="px-2 py-1 bg-gray-200 rounded text-xs">ESC</kbd> para cerrar
          </div>
          <div className="flex gap-2">
            {presignedUrl && (
              <Button
                variant="outline"
                onClick={() => window.open(presignedUrl, '_blank')}
              >
                Abrir en nueva pestaña
              </Button>
            )}
            <Button onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
