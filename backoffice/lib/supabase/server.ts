import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function createServerSupabaseClient(opts?: { accessToken?: string | null }) {
  const cookieStore = await cookies()

  // Obtener el token de sesión de las cookies
  const accessToken = opts?.accessToken ?? cookieStore.get('sb-access-token')?.value ?? null

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: accessToken ? {
          Authorization: `Bearer ${accessToken}`
        } : {}
      }
    }
  )

  return supabase
}
