import { useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'

export function LoginSimple() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleGoogleLogin = async () => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        toast.error(error.message)
        setLoading(false)
      } else {
        toast.success('Redirigiendo a Google...')
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Error al iniciar sesión'))
      setLoading(false)
    }
  }

  const handlePasswordSignIn = async () => {
    if (!email || !password) {
      toast.error('Por favor ingresa email y contraseña')
      return
    }

    try {
      setLoading(true)
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        toast.error(error.message)
      } else {
        toast.success('¡Sesión iniciada!')
        window.location.href = '/auth/callback'
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Error al iniciar sesión'))
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordSignUp = async () => {
    if (!email || !password) {
      toast.error('Por favor ingresa email y contraseña')
      return
    }

    if (password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }

    try {
      setLoading(true)
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        toast.error(error.message)
      } else {
        toast.success('¡Cuenta creada! Iniciando sesión...')
        window.location.href = '/auth/callback'
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Error al crear cuenta'))
    } finally {
      setLoading(false)
    }
  }

  const handleMagicLink = async () => {
    if (!email) {
      toast.error('Por favor ingresa tu email')
      return
    }

    try {
      setLoading(true)
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        toast.error(error.message)
      } else {
        toast.success('¡Enlace enviado! Revisa tu email')
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Error al enviar el enlace'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <motion.div
        className="w-full max-w-md space-y-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <div className="text-center space-y-5">
          <motion.img
            src="/logo.png"
            alt="Confirming"
            className="h-12 mx-auto"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          />
          <motion.p
            className="text-lg text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            Plataforma de Onboarding
          </motion.p>
        </div>

        <motion.div
          className="space-y-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <Button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full h-14 rounded-full text-base"
            variant="outline"
          >
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continuar con Google
          </Button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-3 text-muted-foreground">o</span>
            </div>
          </div>

          <div className="space-y-4">
            <Input
              variant="typeform"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="text-xl md:text-2xl"
            />

            {showPassword && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.3 }}
              >
                <Input
                  variant="typeform"
                  type="password"
                  placeholder="Contraseña (mín. 6 caracteres)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="text-xl md:text-2xl"
                />
              </motion.div>
            )}

            {showPassword ? (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={handlePasswordSignIn}
                  disabled={loading}
                  className="h-14 rounded-full text-base"
                  variant="outline"
                >
                  Iniciar sesión
                </Button>
                <Button
                  onClick={handlePasswordSignUp}
                  disabled={loading}
                  className="h-14 rounded-full text-base"
                >
                  Crear cuenta
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleMagicLink}
                disabled={loading}
                className="w-full h-14 rounded-full text-base"
              >
                {loading ? 'Enviando...' : 'Enviar enlace mágico'}
              </Button>
            )}

            <Button
              onClick={() => setShowPassword(!showPassword)}
              disabled={loading}
              variant="ghost"
              className="w-full text-sm text-muted-foreground"
              type="button"
            >
              {showPassword ? '← Volver a Magic Link' : 'Usar email y contraseña →'}
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground pt-4">
            Al continuar, aceptas nuestros términos y condiciones
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}
