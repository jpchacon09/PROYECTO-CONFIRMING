import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Obtener token de las cookies
  const accessToken = request.cookies.get('sb-access-token')?.value

  if (!accessToken && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (accessToken) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      }
    )

    const { data: { user }, error } = await supabase.auth.getUser()

    // Si está en login y ya está autenticado, redirigir al dashboard
    if (request.nextUrl.pathname === '/login' && user) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Si NO está autenticado y intenta acceder a rutas protegidas
    if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Si está autenticado, verificar que sea admin
    if (user && request.nextUrl.pathname.startsWith('/dashboard')) {
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', user.id)
        .single()

      if (!usuario || usuario.rol !== 'admin') {
        return NextResponse.redirect(new URL('/login?error=unauthorized', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/login',
  ],
}
