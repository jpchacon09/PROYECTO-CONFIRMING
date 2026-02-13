import { createClient } from '@supabase/supabase-js'

// Cliente con Service Role Key para operaciones de admin (solo server-side)
// No usamos tipos estrictos para evitar problemas con updates
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)
