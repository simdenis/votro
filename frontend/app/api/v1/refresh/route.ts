import { json } from '@/lib/api-v1'

// Nightly cron target (see vercel.json). Re-fetches each bulk export through the
// public origin so the CDN cache is warm and fresh every morning — visitors get
// a same-day file without ever triggering a cold DB dump themselves.
export const dynamic = 'force-dynamic'

const SETS = ['voturi', 'legi', 'deputati', 'senatori']

export async function GET(req: Request) {
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
  return json({ refreshed: results, at: new Date().toISOString() })
}
