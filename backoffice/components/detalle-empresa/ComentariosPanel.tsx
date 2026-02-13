'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { ComentarioInterno } from '@/lib/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { MessageSquare, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface ComentariosPanelProps {
  comentarios: ComentarioInterno[]
  empresaId: string
}

export function ComentariosPanel({ comentarios: initialComentarios, empresaId }: ComentariosPanelProps) {
  const router = useRouter()
  const [nuevoComentario, setNuevoComentario] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!nuevoComentario.trim()) return

    try {
      setLoading(true)

      // Obtener usuario actual
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        alert('No estás autenticado')
        return
      }

      // Insertar comentario
      const { error } = await supabase
        .from('comentarios_internos')
        .insert({
          empresa_id: empresaId,
          usuario_id: user.id,
          comentario: nuevoComentario.trim()
        })

      if (error) {
        console.error('Error al guardar comentario:', error)
        alert('Error al guardar el comentario')
        return
      }

      setNuevoComentario('')
      router.refresh() // Recargar la página para mostrar el nuevo comentario
    } catch (error) {
      console.error('Error:', error)
      alert('Error al guardar el comentario')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comentarios Internos ({initialComentarios.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Lista de comentarios */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {initialComentarios.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No hay comentarios internos
              </p>
            ) : (
              initialComentarios.map((comentario) => (
                <div
                  key={comentario.id}
                  className="bg-gray-50 rounded-lg p-3 border"
                >
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">
                    {comentario.comentario}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                    <span>Admin</span>
                    <span>•</span>
                    <span>
                      {format(new Date(comentario.created_at), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Formulario para nuevo comentario */}
          <form onSubmit={handleSubmit} className="space-y-3 border-t pt-4">
            <Textarea
              placeholder="Escribe un comentario interno (no visible para el cliente)..."
              value={nuevoComentario}
              onChange={(e) => setNuevoComentario(e.target.value)}
              rows={3}
              disabled={loading}
            />
            <Button
              type="submit"
              disabled={loading || !nuevoComentario.trim()}
              className="w-full"
            >
              {loading ? (
                'Guardando...'
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Agregar Comentario
                </>
              )}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  )
}
