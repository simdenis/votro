import { ImageResponse } from 'next/og'
import { getCardFonts } from '@/lib/og-fonts'
import { hasPartyLine } from '@/lib/utils'

const U = process.env.NEXT_PUBLIC_SUPABASE_URL!
const K = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SB = { apikey: K, Authorization: `Bearer ${K}` }

const PARTY_ORDER = ['PSD', 'AUR', 'PNL', 'USR', 'UDMR', 'POT', 'SOSRO', 'PACE']
const BASE = '47, 111, 208' // matches components/charts/agreement-matrix.tsx
const MONTHS_RO = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec']

// 'YYYY-MM' → "iun '26"; null-safe.
function fmtMonth(m: string | null): string | null {
  if (!m || !/^\d{4}-\d{2}$/.test(m)) return null
  const [y, mo] = m.split('-').map(Number)
  return `${MONTHS_RO[mo - 1]} '${String(y).slice(2)}`
}

// Darker = more agreement, over a light surface. Mirrors the on-page matrix.
function cellBg(pct: number) {
  const a = Math.max(0, Math.min(1, (pct - 30) / 70)) * 0.92 + 0.05
  return { bg: `rgba(${BASE}, ${a.toFixed(2)})`, ink: a > 0.5 ? '#ffffff' : '#171A1F' }
}

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams
  const from = fmtMonth(sp.get('from')) ? sp.get('from') : null
  const to = fmtMonth(sp.get('to')) ? sp.get('to') : null

  const [agRes, pRes] = await Promise.all([
    fetch(`${U}/rest/v1/party_agreement_monthly?select=party_a,party_b,month,shared,agreed`, { headers: SB }),
    fetch(`${U}/rest/v1/parties?select=abbreviation,color`, { headers: SB }),
  ])
  const rows = (await agRes.json()) as { party_a: string; party_b: string; month: string; shared: number; agreed: number }[]
  const pj = (await pRes.json()) as { abbreviation: string; color: string }[]

  const colorOf: Record<string, string> = {}
  for (const p of pj) colorOf[p.abbreviation] = p.color

  const key = (a: string, b: string) => [a, b].sort().join('|')
  const present = new Set<string>()
  const acc: Record<string, { shared: number; agreed: number }> = {}
  for (const r of Array.isArray(rows) ? rows : []) {
    // respect the slider's month window when passed
    if (from && r.month < from) continue
    if (to && r.month > to) continue
    present.add(r.party_a); present.add(r.party_b)
    const k = key(r.party_a, r.party_b)
    ;(acc[k] ??= { shared: 0, agreed: 0 })
    acc[k].shared += r.shared; acc[k].agreed += r.agreed
  }

  const rangeLabel = from && to
    ? (from === to ? fmtMonth(from)! : `${fmtMonth(from)} – ${fmtMonth(to)}`)
    : 'toată legislatura'
  const parties = PARTY_ORDER.filter(a => colorOf[a] && hasPartyLine(a) && present.has(a))
  const pctOf = (a: string, b: string) => {
    const r = acc[key(a, b)]
    return r && r.shared > 0 ? Math.round((r.agreed / r.shared) * 100) : null
  }

  const cell = Math.floor(780 / (parties.length + 1))
  const fonts = await getCardFonts()

  const headerCell = (abbr: string) => (
    <div style={{ width: cell, height: cell, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700, color: colorOf[abbr] }}>
      {abbr}
    </div>
  )

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 1200, display: 'flex', flexDirection: 'column', background: '#FFFFFF', padding: 64, fontFamily: 'IBM Plex Sans' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <svg width="56" height="56" viewBox="0 0 64 64">
            <rect width="64" height="64" rx="15" fill="#171A1F" />
            <rect x="11" y="11" width="18" height="18" rx="6" fill="#2EA871" />
            <rect x="35" y="11" width="18" height="18" rx="6" fill="#E3A23C" />
            <rect x="11" y="35" width="18" height="18" rx="6" fill="#EE7B5E" />
            <rect x="35" y="35" width="18" height="18" rx="6" fill="#4E86D8" />
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 46, fontWeight: 700, color: '#171A1F', fontFamily: 'Plex Display' }}>Cine votează cu cine</div>
            <div style={{ fontSize: 22, color: '#6E7480' }}>{`Acord pe voturile disputate · ${rangeLabel}`}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', margin: 'auto', alignSelf: 'center' }}>
          <div style={{ display: 'flex' }}>
            <div style={{ width: cell, height: cell, display: 'flex' }} />
            {parties.map(b => headerCell(b))}
          </div>
          {parties.map(a => (
            <div key={a} style={{ display: 'flex' }}>
              {headerCell(a)}
              {parties.map(b => {
                if (a === b) {
                  return (
                    <div key={b} style={{ width: cell, height: cell, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F1F3', border: '2px solid #fff' }}>
                      <div style={{ width: 16, height: 16, borderRadius: 8, background: colorOf[a] }} />
                    </div>
                  )
                }
                const pct = pctOf(a, b)
                const { bg, ink } = pct != null ? cellBg(pct) : { bg: '#F0F1F3', ink: '#9AA0AA' }
                return (
                  <div key={b} style={{ width: cell, height: cell, display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, border: '2px solid #fff', fontSize: 24, fontWeight: 700, color: ink }}>
                    {pct != null ? `${pct}%` : '—'}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: 20, color: '#8A8F98' }}>Nuanță închisă = acord mare</div>
          <div style={{ display: 'flex', fontSize: 24, color: '#B0B4BA', fontWeight: 700 }}>la-butoane.ro</div>
        </div>
      </div>
    ),
    { width: 1200, height: 1200, fonts },
  )
}
