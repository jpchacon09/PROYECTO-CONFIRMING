import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.session) {
      // Guardar tokens en cookies
      const cookieStore = await cookies()
      cookieStore.set('sb-access-token', data.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 días
        path: '/',
      })
      cookieStore.set('sb-refresh-token', data.session.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 días
        path: '/',
      })

      // Verificar que el usuario exista en la tabla usuarios y sea admin
      const user = data.user

      if (user) {
        const supabaseWithToken = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            global: {
              headers: {
                Authorization: `Bearer ${data.session.access_token}`
              }
            }
          }
        )

        const { data: usuario } = await supabaseWithToken
          .from('usuarios')
          .select('rol')
          .eq('id', user.id)
          .single()

        if (!usuario) {
          // Crear usuario con rol admin (solo para desarrollo)
          await supabaseWithToken.from('usuarios').insert({
            id: user.id,
            rol: 'admin',
          })
        } else if (usuario.rol !== 'admin') {
          // No es admin, redirigir a error
          return NextResponse.redirect(`${origin}/login?error=unauthorized`)
        }
      }

      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  // Error or no code, redirect to login
  return NextResponse.redirect(`${origin}/login`)
}
