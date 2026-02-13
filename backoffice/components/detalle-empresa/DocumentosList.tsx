'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Documento } from '@/lib/types'
import { TIPO_DOCUMENTO_LABELS } from '@/constants/documentos'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Eye, Download, FileText, Check, Clock } from 'lucide-react'
import { DocumentViewer } from './DocumentViewer'

interface DocumentosListProps {
  documentos: Documento[]
  empresaId: string
}

export function DocumentosList({ documentos, empresaId }: DocumentosListProps) {
  const [selectedDoc, setSelectedDoc] = useState<Documento | null>(null)

  if (documentos.length === 0) {
    return (
      <div className="py-12 text-center">
        <FileText className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No hay documentos</h3>
        <p className="mt-1 text-sm text-gray-500">
          Esta empresa aún no ha subido documentos
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {documentos.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between rounded-lg border p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-4 flex-1">
              <FileText className="h-8 w-8 text-blue-600" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900">
                    {TIPO_DOCUMENTO_LABELS[doc.tipo_documento]}
                  </p>
                  {doc.extraccion_completa ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <Check className="h-3 w-3 mr-1" />
                      Extraído
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                      <Clock className="h-3 w-3 mr-1" />
                      Pendiente
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <p className="text-sm text-gray-500">{doc.nombre_original}</p>
                  <p className="text-sm text-gray-400">
                    {(doc.tamano_bytes / 1024).toFixed(0)} KB
                  </p>
                  <p className="text-sm text-gray-400">
                    {format(new Date(doc.created_at), 'dd MMM yyyy', { locale: es })}
                  </p>
                </div>
                {doc.extraccion_completa && doc.extraccion_confianza && (
                  <p className="text-xs text-gray-500 mt-1">
                    Confianza: {(doc.extraccion_confianza * 100).toFixed(0)}%
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDoc(doc)}
              >
                <Eye className="h-4 w-4 mr-2" />
                Ver
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // TODO: Implementar descarga directa
                  setSelectedDoc(doc)
                }}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Visor de documentos */}
      {selectedDoc && (
        <DocumentViewer
          documento={selectedDoc}
          onClose={() => setSelectedDoc(null)}
        />
      )}
    </>
  )
}
