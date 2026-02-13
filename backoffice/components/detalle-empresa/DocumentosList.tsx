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
}

export function DocumentosList({ documentos }: DocumentosListProps) {
  const [selectedDoc, setSelectedDoc] = useState<Documento | null>(null)

  if (documentos.length === 0) {
    return (
      <div className="py-12 text-center">
        <FileText className="mx-auto h-12 w-12 text-muted-foreground/70" />
        <h3 className="mt-2 text-sm font-medium text-foreground">No hay documentos</h3>
        <p className="mt-1 text-sm text-muted-foreground">
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
            className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-4 flex-1">
              <FileText className="h-8 w-8 text-primary" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">
                    {TIPO_DOCUMENTO_LABELS[doc.tipo_documento]}
                  </p>
                  {doc.extraccion_completa ? (
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                      <Check className="h-3 w-3 mr-1" />
                      Extraído
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                      <Clock className="h-3 w-3 mr-1" />
                      Pendiente
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <p className="text-sm text-muted-foreground">{doc.nombre_original}</p>
                  <p className="text-sm text-muted-foreground/70">
                    {(doc.tamano_bytes / 1024).toFixed(0)} KB
                  </p>
                  <p className="text-sm text-muted-foreground/70">
                    {format(new Date(doc.created_at), 'dd MMM yyyy', { locale: es })}
                  </p>
                </div>
                {doc.extraccion_completa && doc.extraccion_confianza && (
                  <p className="text-xs text-muted-foreground mt-1">
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
