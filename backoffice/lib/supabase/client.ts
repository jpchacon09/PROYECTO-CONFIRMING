import { createClient } from '@supabase/supabase-js'

// No usamos tipos estrictos para evitar problemas con TypeScript
export function createBrowserSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Export una instancia singleton para usar en client components
export const supabase = createBrowserSupabaseClient()
