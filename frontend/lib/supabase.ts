import { createClient } from '@supabase/supabase-js'

// One factory per call — no module-level singleton — safe for RSC/SSR
export function getDB() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  )
}
