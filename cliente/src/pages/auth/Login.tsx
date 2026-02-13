import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const { signInWithGoogle, signInWithMagicLink } = useAuth()

  const handleGoogleLogin = async () => {
    try {
      setLoading(true)
      await signInWithGoogle()
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Error al iniciar sesión con Google'))
      setLoading(false)
    }
  }

  const handleMagicLinkLogin = async () => {
    if (!email) {
      toast.error('Por favor ingresa tu email')
      return
    }

    try {
      setLoading(true)
      await signInWithMagicLink(email)
      setEmailSent(true)
      toast.success('¡Enlace enviado! Revisa tu email')
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Error al enviar el enlace'))
    } finally {
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

  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">¡Enlace enviado!</CardTitle>
            <CardDescription>
              Hemos enviado un enlace mágico a <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center text-sm text-muted-foreground">
            <p>Revisa tu bandeja de entrada y haz clic en el enlace para iniciar sesión.</p>
            <p>El enlace expira en 1 hora.</p>
            <Button
              variant="outline"
              onClick={() => setEmailSent(false)}
              className="mt-4"
            >
              Volver a intentar
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <img src="/logo.png" alt="Confirming" className="h-10 mx-auto" />
          <CardDescription className="text-base">
            Plataforma de Onboarding
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full h-12"
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

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">o</span>
            </div>
          </div>

          <div className="space-y-4">
            <Input
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="h-12"
            />

            {showPassword && (
              <Input
                type="password"
                placeholder="Contraseña (mín. 6 caracteres)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="h-12"
              />
            )}

            {showPassword ? (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={handlePasswordSignIn}
                  disabled={loading}
                  className="h-12"
                  variant="outline"
                >
                  Iniciar sesión
                </Button>
                <Button
                  onClick={handlePasswordSignUp}
                  disabled={loading}
                  className="h-12"
                >
                  Crear cuenta
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleMagicLinkLogin}
                disabled={loading}
                className="w-full h-12"
              >
                {loading ? 'Enviando...' : 'Enviar enlace mágico'}
              </Button>
            )}

            <Button
              onClick={() => setShowPassword(!showPassword)}
              disabled={loading}
              variant="ghost"
              className="w-full text-sm"
              type="button"
            >
              {showPassword ? '← Volver a Magic Link' : 'Usar email y contraseña →'}
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-4">
            Al continuar, aceptas nuestros términos y condiciones
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
