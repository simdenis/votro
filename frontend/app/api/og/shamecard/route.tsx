import { ImageResponse } from 'next/og'
import { ShameCard, type ShameCardData, type ShameEntry } from '@/components/cards/shame-card'
import { getCardFonts } from '@/lib/og-fonts'
import { withEdgeCache } from '@/lib/og-edge-cache'

// 1080×1350 (4:5) Instagram shame-corner card — top absentees.
//   /api/og/shamecard                          → all-time (cumulative) ranking, from the stats views
//   /api/og/shamecard?d=<b64url>&label=…&sig=…  → interval ranking, precomputed by the poster
//
// Interval mode renders ONLY passed data (no DB work → stays under the CPU cap),
// but the payload is HMAC-signed with CARD_SIGN_SECRET so this public route can't
// be used to mint arbitrary "X% absent" cards under the brand. No secret set →
// interval mode is disabled and it falls back to the all-time card.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SB = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }

const MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
                'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie']

async function verifySig(d: string, sig: string | null, secret: string | undefined): Promise<boolean> {
  if (!secret || !sig) return false
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(d))
  const hex = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
  // length-equal compare (sig is 32 hex chars); avoid early-exit timing leak
  if (sig.length !== hex.length) return false
  let diff = 0
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ sig.charCodeAt(i)
  return diff === 0
}

async function fetchWorst(view: string, chamber: ShameEntry['chamber']): Promise<ShameEntry[]> {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/${view}?select=name,first_name,party_abbr,party_color,presence_pct` +
      `&active=eq.true&gov_role=is.null&order=presence_pct.asc&limit=5`,
    { headers: SB },
  )
  const rows: any[] = (await r.json()) ?? []
  return rows.map(s => ({
    name: `${s.first_name} ${s.name}`,
    partyAbbr: s.party_abbr,
    partyColor: s.party_color || '#9e9e9e',
    chamber,
    absencePct: Math.round(100 - (s.presence_pct ?? 100)),
  }))
}

export async function GET(req: Request) {
  return withEdgeCache(req, () => renderCard(req))
}

async function renderCard(req: Request): Promise<Response> {
  const sp = new URL(req.url).searchParams
  const d = sp.get('d')
  let data: ShameCardData

  if (d && await verifySig(d, sp.get('sig'), process.env.CARD_SIGN_SECRET)) {
    // interval mode: render the poster's precomputed, signed ranking. `d` is
    // base64url (NOT percent-encoded JSON): URL normalization decodes %23 → '#'
    // en route, which turns the rest of the query into a fragment and drops
    // &sig. The HMAC is over the encoded string. Coerce/clamp every field
    // defensively even though the signature already vouches for it.
    const raw = JSON.parse(Buffer.from(d, 'base64url').toString('utf8')) as { n: string; p: string; c: string; ch: string; a: number; x?: number; h?: number }[]
    const entries: ShameEntry[] = raw.slice(0, 10).map(e => {
      const held = Number.isFinite(e.h) ? Math.max(0, Math.round(Number(e.h))) : undefined
      const absent = Number.isFinite(e.x) ? Math.max(0, Math.round(Number(e.x))) : undefined
      return {
        name: String(e.n).slice(0, 48),
        partyAbbr: String(e.p).slice(0, 8),
        partyColor: /^#[0-9a-fA-F]{6}$/.test(e.c) ? e.c : '#9e9e9e',
        chamber: e.ch === 'SENAT' ? 'SENAT' : 'CAMERĂ',
        absencePct: Math.max(0, Math.min(100, Math.round(Number(e.a) || 0))),
        ...(held != null ? { held } : {}),
        ...(absent != null ? { absent } : {}),
      }
    })
    const label = (sp.get('label') ?? '').slice(0, 40)
    data = {
      dateLabel: label.toLowerCase(),
      subtitle: `absențe la voturile din plen · ${label} · Senat + Cameră`,
      entries,
    }
  } else {
    const [senators, deputies] = await Promise.all([
      fetchWorst('senator_stats', 'SENAT'),
      fetchWorst('deputy_stats', 'CAMERĂ'),
    ])
    // cumulative since mandate start — NOT the current month (that read as
    // "this month's absences" when it's the whole mandate)
    data = {
      dateLabel: 'dec. 2024 – prezent',
      entries: [...senators, ...deputies].sort((a, b) => b.absencePct - a.absencePct).slice(0, 5),
    }
  }

  const fonts = await getCardFonts()
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: 1080, height: 1350, transform: 'scale(2)', transformOrigin: 'top left' }}>
        <ShameCard data={data} />
      </div>
    ),
    { width: 2160, height: 2700, fonts },
  )
}
