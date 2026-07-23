import { createClient } from '@supabase/supabase-js'

// One factory per call — no module-level singleton — safe for RSC/SSR.
//
// supabase-js issues `cache: 'no-store'` fetches, which forces every page that
// reads from it fully dynamic in Next 15 — silently defeating each detail
// route's `export const revalidate` (so /legi/[id], /senatori/[id] etc. hit the
// DB on EVERY visitor, a real scale risk when a link is shared). Re-enable ISR:
// strip no-store and cache reads 10 min at the edge. Pages/routes that need
// live data are `force-dynamic`, which overrides this and stays fresh.
export function getDB() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
      global: {
        fetch: (input, init) => {
          const { cache: _drop, ...rest } = (init ?? {}) as RequestInit
          return fetch(input as RequestInfo, { ...rest, next: { revalidate: 600 } } as RequestInit)
        },
      },
    },
  )
}
