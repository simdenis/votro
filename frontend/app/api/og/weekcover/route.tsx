import { ImageResponse } from 'next/og'
import { getCardFonts } from '@/lib/og-fonts'
import { withEdgeCache } from '@/lib/og-edge-cache'
import { WeekCoverCard } from '@/components/cards/week-cover'
import { isUuid } from '@/lib/utils'

const U = process.env.NEXT_PUBLIC_SUPABASE_URL!
const K = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SB = { apikey: K, Authorization: `Bearer ${K}` }

// 1080×1350 cover for the weekly digest carousel — slide 1, then a summary
// card per law. /api/og/weekcover?n=<count>[&kind=votate]
// kind=votate: "voturi finale adoptate" wording instead of "promulgate" —
// a bill that just cleared a final vote is NOT law yet, the cover must not
// claim it is.

const C = { bg: '#FFFFFF', text: '#171A1F', for: '#2EA871', hair: '#E7E9EC', faint: '#6E7480' }
const SERIF = 'Plex Display'
const SANS = 'IBM Plex Sans'
const MONO = 'IBM Plex Mono'
const RO_MONTHS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec']

export async function GET(req: Request) {
  return withEdgeCache(req, () => render(req))
}

async function render(req: Request): Promise<Response> {
  const sp = new URL(req.url).searchParams
  const n = Math.max(1, Math.min(20, Number(sp.get('n')) || 0))
  const kind = sp.get('kind')  // default: promulgate · votate · parlament (both chambers, at the President)
  const votate = kind === 'votate'
  const parlament = kind === 'parlament'
  const now = new Date()
  // promulgate/parlament: the trailing 7 days; votate: the previous calendar week Mon–Sun
  const lastMon = new Date(now.getTime() - (((now.getDay() + 6) % 7) + 7) * 86400_000)
  const from = votate ? lastMon : new Date(now.getTime() - 6 * 86400_000)
  const to = votate ? new Date(lastMon.getTime() + 6 * 86400_000) : now
  const range = `${from.getDate()} ${RO_MONTHS[from.getMonth()]} – ${to.getDate()} ${RO_MONTHS[to.getMonth()]} ${to.getFullYear()}`
  const noun = votate
    ? (n === 1 ? 'vot final adoptat' : 'voturi finale adoptate')
    : parlament
    ? (n === 1 ? 'lege trimisă la promulgare' : 'legi trimise la promulgare')
    : (n === 1 ? 'lege promulgată' : 'legi promulgate')
  const title = votate ? 'Ce a votat Parlamentul săptămâna trecută'
    : parlament ? 'Ce a trecut de Parlament săptămâna asta'
    : 'Ce s-a făcut lege săptămâna asta'
  const kicker = votate ? 'Săptămâna trecută' : 'Săptămâna aceasta'

  // v2: ?ids=<law>,<law>… (slide order) → the cover lists every law's title,
  // so a carousel is understood from slide 1. Without ids: the classic cover.
  const ids = (sp.get('ids') ?? '').split(',').filter(isUuid).slice(0, 12)
  if (ids.length) {
    const rows = ((await fetch(`${U}/rest/v1/laws?id=in.(${ids.join(',')})&select=id,code,headline,title,explainer`, { headers: SB })
      .then(r => r.json()).catch(() => [])) ?? []) as { id: string; code: string; headline: string | null; title: string; explainer: { titlu?: string } | null }[]
    const byId = new Map(rows.map(r => [r.id, r]))
    const items = ids.map(i => byId.get(i)).filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map(r => ({ code: r.code, headline: r.explainer?.titlu ?? r.headline ?? r.title }))
    const v2Range = `${from.getDate()} ${RO_MONTHS[from.getMonth()]} – ${to.getDate()} ${RO_MONTHS[to.getMonth()]} ${to.getFullYear()}`
    const fonts = await getCardFonts()
    return new ImageResponse(
      (
        <div style={{ display: 'flex', width: 1080, height: 1350 }}>
          <WeekCoverCard data={{ kind: (['votate', 'parlament', 'presedinte', 'respinse'] as const).find(k => k === kind) ?? 'promulgate', range: v2Range, items, count: n }} />
        </div>
      ),
      { width: 1080, height: 1350, fonts },
    )
  }

  const fonts = await getCardFonts()
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: 1080, height: 1350 }}>
        <div style={{ width: 1080, height: 1350, display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: SANS }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '54px 72px 0' }}>
            <div style={{ display: 'flex', fontFamily: MONO, fontSize: 18, letterSpacing: 3, textTransform: 'uppercase', color: C.faint }}>{kicker}</div>
            <div style={{ display: 'flex', fontFamily: MONO, fontSize: 15, color: C.faint }}>{range}</div>
          </div>

          <div style={{ display: 'flex', flex: 1, alignItems: 'center', padding: '0 72px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ fontFamily: SERIF, fontSize: 82, lineHeight: 1.04, color: C.text }}>{title}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 34 }}>
                <div style={{ display: 'flex', fontFamily: SERIF, fontSize: 72, color: C.for }}>{`${n}`}</div>
                <div style={{ display: 'flex', fontSize: 30, color: C.text, opacity: 0.7 }}>{noun}</div>
              </div>
            </div>
          </div>


          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 72px', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: C.hair }}>
            <div style={{ display: 'flex', fontFamily: MONO, fontSize: 15, fontWeight: 500, color: C.text }}>@la.butoane</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="34" height="34" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#171A1F" /><rect x="11" y="11" width="18" height="18" rx="6" fill="#2EA871" /><rect x="35" y="11" width="18" height="18" rx="6" fill="#E3A23C" /><rect x="11" y="35" width="18" height="18" rx="6" fill="#EE7B5E" /><rect x="35" y="35" width="18" height="18" rx="6" fill="#4E86D8" /></svg>
              <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 26, letterSpacing: '-0.015em', color: '#171A1F' }}>
                <span style={{ fontWeight: 400 }}>La</span><span style={{ fontWeight: 700 }}>Butoane</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1350, fonts },
  )
}
