import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export function Callback() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          toast.error('Error al autenticar')
          navigate('/login')
          return
        }

        if (!session) {
          navigate('/login')
          return
        }

        // Verificar/crear usuario en tabla usuarios
        const { data: usuario, error: usuarioError } = await supabase
          .from('usuarios')
          .select('*')
          .eq('id', session.user.id)
          .single()

        // Si no existe, crear con rol 'pagador'
        if (usuarioError || !usuario) {
          await supabase
            .from('usuarios')
            .insert({ id: session.user.id, rol: 'pagador' })
        }

        // Verificar si ya tiene una empresa registrada
        const { data: empresa } = await supabase
          .from('empresas_pagadoras')
          .select('*')
          .eq('usuario_id', session.user.id)
          .single()

        // Redirigir según el caso
        if (!empresa) {
          // Primera vez, ir a formulario
          navigate('/onboarding/datos-empresa')
        } else if (empresa.estado === 'documentos_incompletos') {
          // Puede editar, ir a documentos
          navigate('/onboarding/documentos')
        } else {
          // Ver estado de solicitud
          navigate('/dashboard')
        }
      } catch (error) {
        console.error('Error en callback:', error)
        navigate('/login')
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Iniciando sesión...</p>
      </div>
    </div>
  )
}
