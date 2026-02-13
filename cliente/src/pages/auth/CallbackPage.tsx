import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export function CallbackPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('Procesando autenticación...')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('Callback iniciado')

        // Obtener la sesión actual
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        console.log('Sesión:', session)
        console.log('Error de sesión:', sessionError)

        if (sessionError) {
          setStatus('Error al obtener sesión')
          console.error('Error:', sessionError)
          setTimeout(() => navigate('/login'), 2000)
          return
        }

        if (!session) {
          setStatus('No hay sesión activa')
          setTimeout(() => navigate('/login'), 2000)
          return
        }

        setStatus('Sesión obtenida. Verificando usuario...')

        // Verificar si el usuario existe en la tabla usuarios
        const { data: usuario, error: usuarioError } = await supabase
          .from('usuarios')
          .select('*')
          .eq('id', session.user.id)
          .single()

        console.log('Usuario en DB:', usuario)
        console.log('Error usuario:', usuarioError)

        // Si no existe, crearlo con rol 'pagador'
        if (usuarioError && usuarioError.code === 'PGRST116') {
          setStatus('Creando usuario...')
          console.log('Creando usuario nuevo con rol pagador')

          const { error: insertError } = await supabase
            .from('usuarios')
            .insert({
              id: session.user.id,
              rol: 'pagador'
            })

          if (insertError) {
            console.error('Error al crear usuario:', insertError)
            setStatus('Error al crear usuario')
            setTimeout(() => navigate('/login'), 2000)
            return
          }
        }

        setStatus('Verificando empresa...')

        // Verificar si tiene una empresa registrada
        const { data: empresa, error: empresaError } = await supabase
          .from('empresas_pagadoras')
          .select('*')
          .eq('usuario_id', session.user.id)
          .single()

        console.log('Empresa:', empresa)
        console.log('Error empresa:', empresaError)

        // Redirigir según el caso
        if (empresaError && empresaError.code === 'PGRST116') {
          // No tiene empresa, ir a formulario
          setStatus('Redirigiendo al formulario...')
          setTimeout(() => navigate('/onboarding/datos-empresa'), 1000)
        } else if (empresa && empresa.estado === 'documentos_incompletos') {
          // Puede editar documentos
          setStatus('Redirigiendo a documentos...')
          setTimeout(() => navigate('/onboarding/documentos'), 1000)
        } else {
          // Ver dashboard
          setStatus('Redirigiendo al dashboard...')
          setTimeout(() => navigate('/dashboard'), 1000)
        }

      } catch (error) {
        console.error('Error en callback:', error)
        setStatus('Error inesperado')
        setTimeout(() => navigate('/login'), 2000)
      }
    }

    handleCallback()
  }, [navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-gray-600 text-lg">{status}</p>
      </div>
    </div>
  )
}
