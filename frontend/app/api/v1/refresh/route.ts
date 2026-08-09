import { json, secretMatches } from '@/lib/api-v1'

// Nightly cron target (called from the VPS daily flow, deploy/run_daily.sh).
// Re-fetches each bulk export through the public origin so the CDN cache is warm
// and fresh every morning — visitors get a same-day file without ever triggering
// a cold DB dump themselves. Protected by CRON_SECRET: it fans out ~240 upstream
// queries, so it must not be publicly callable.
export const dynamic = 'force-dynamic'

const SETS = ['voturi', 'legi', 'deputati', 'senatori']

function authed(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  return secretMatches(req.headers.get('x-cron-secret'), secret)
    || secretMatches(bearer || null, secret)
}

// Housekeeping RPCs (migrations 055/056): drop stale unconfirmed alert/newsletter
// signups. Piggy-backs on the nightly cron so no extra cron entry is needed.
async function purge() {
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL
  const K = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!U || !K) return
  const hdrs = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }
  await Promise.all(['purge_unconfirmed_alerts', 'purge_newsletter_pending'].map(fn =>
    fetch(`${U}/rest/v1/rpc/${fn}`, { method: 'POST', headers: hdrs, body: '{}' }).catch(() => {}),
  ))
}

export async function GET(req: Request) {
  if (!authed(req)) return json({ error: 'unauthorized' }, 401)
  const origin = new URL(req.url).origin
  const results = await Promise.all(
    SETS.flatMap(s => ['json', 'csv'].map(async fmt => {
      try {
        const r = await fetch(`${origin}/api/v1/export/${s}?format=${fmt}`, { cache: 'no-store' })
        return { set: s, fmt, status: r.status }
      } catch {
        return { set: s, fmt, status: 0 }
      }
    })),
  )
  await purge()
  return json({ refreshed: results, at: new Date().toISOString() })
}
