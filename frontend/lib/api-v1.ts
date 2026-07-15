// Shared plumbing for the public /api/v1/* endpoints.
//
// Why this exists: "Ia datele" used to hand visitors a curl line straight to
// Supabase (project ref + anon JWT, no cache, no rate limit). These endpoints
// put a server-side proxy in front — the key never reaches the client, every
// response is CDN-cacheable, and the public contract is decoupled from the
// Supabase schema/ref so we could migrate the backend without breaking anyone
// who scripted against the API. Read-only, public civic data only.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ── param sanitizers ─────────────────────────────────────────────────────────
// Values are interpolated into PostgREST filters (e.g. code=eq.<v>), so anything
// user-supplied is whitelisted to stop filter/logic-tree injection.
export function cleanCode(v: string | null): string | null {
  if (!v) return null
  const t = v.trim().toUpperCase()
  return /^[A-Z0-9][A-Z0-9/.\-]{0,24}$/.test(t) ? t : null
}
export function cleanDate(v: string | null): string | null {
  if (!v) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null
}
export function cleanChamber(v: string | null): 'deputies' | 'senate' | null {
  const t = (v ?? '').trim().toLowerCase()
  if (['deputies', 'camera', 'cameră', 'cdep'].includes(t)) return 'deputies'
  if (['senate', 'senat'].includes(t)) return 'senate'
  return null
}
/** Names feed an ilike filter — keep letters (incl. RO diacritics), spaces and
 *  hyphens, drop PostgREST-significant chars (, ( ) * . ), cap the length. */
export function cleanName(v: string | null): string | null {
  if (!v) return null
  const t = v.trim().replace(/[^\p{L}\s\-]/gu, '').slice(0, 40).trim()
  return t || null
}

// ── response helper ──────────────────────────────────────────────────────────
export function wantsCsv(req: Request): boolean {
  const f = new URL(req.url).searchParams.get('format')
  if (f) return f.toLowerCase() === 'csv'
  return (req.headers.get('accept') ?? '').includes('text/csv')
}

interface ProxyOpts { maxAge?: number; swr?: number; filename?: string }

/** Run a PostgREST query server-side and return it JSON or CSV, with CDN cache
 *  headers. `path` is the PostgREST path+query without a leading slash. */
export async function proxy(path: string, req: Request, opts: ProxyOpts = {}): Promise<Response> {
  const csv = wantsCsv(req)
  const maxAge = opts.maxAge ?? 3600
  const swr = opts.swr ?? 86400
  let upstream: Response
  try {
    upstream = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Accept: csv ? 'text/csv' : 'application/json',
      },
      next: { revalidate: maxAge },
    })
  } catch {
    return json({ error: 'Sursa de date e indisponibilă momentan.' }, 502)
  }
  const body = await upstream.text()
  if (!upstream.ok) {
    return json({ error: 'Interogare invalidă.' }, upstream.status === 400 ? 400 : 502)
  }
  const headers: Record<string, string> = {
    'Content-Type': csv ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
    'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=${swr}`,
    'Access-Control-Allow-Origin': '*',
  }
  if (csv && opts.filename) headers['Content-Disposition'] = `attachment; filename="${opts.filename}.csv"`
  return new Response(body, { status: 200, headers })
}

export function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  })
}
