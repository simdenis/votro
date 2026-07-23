import { NextRequest } from 'next/server'

// Frontend error sink. The error boundaries POST here so a runtime crash lands
// in the Cloudflare Workers log stream (visible in the CF dashboard without
// tailing). Deliberately tiny and defensive: payload is capped and we never
// throw — a broken logger must not itself error. Not a substitute for Sentry,
// just enough to *notice* breakage after launch.
export async function POST(req: NextRequest) {
  try {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const clip = (v: unknown, n: number) => String(v ?? '').slice(0, n)
    console.error('[clientlog]', JSON.stringify({
      msg: clip(b.msg, 500),
      stack: clip(b.stack, 1500),
      digest: clip(b.digest, 120),
      url: clip(b.url, 300),
      ua: clip(req.headers.get('user-agent'), 200),
      at: new Date().toISOString(),
    }))
  } catch {
    // never throw from the logger
  }
  return new Response(null, { status: 204 })
}
