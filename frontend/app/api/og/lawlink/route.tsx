import { ImageResponse } from 'next/og'
import { mapLawToCard } from '@/lib/votecard'
import { getCardFonts } from '@/lib/og-fonts'
import { categoryColor } from '@/lib/category-colors'
import { isUuid } from '@/lib/utils'
import type { LawStatus } from '@/lib/types'

// 1200×630 link preview for a law page (shared on FB/WhatsApp/Twitter, indexed
// by search). Plain-language headline as hero + summary + status. Light card
// (no hemicycle). /api/og/lawlink?id=<law_id or code slug resolved upstream>

const U = process.env.NEXT_PUBLIC_SUPABASE_URL!
const K = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SB = { apikey: K, Authorization: `Bearer ${K}` }
const C = { text: '#171A1F', navy: '#171A1F', faint: '#6E7480', hair: '#E7E9EC' }

export async function GET(req: Request) {
  const id = isUuid(new URL(req.url).searchParams.get('id')) ? new URL(req.url).searchParams.get('id') : null
  const law = id
    ? (await (await fetch(`${U}/rest/v1/law_status?law_id=eq.${id}&select=*&limit=1`, { headers: SB, cache: 'no-store' })).json())?.[0] as LawStatus | undefined
    : undefined
  const headline = id
    ? await fetch(`${U}/rest/v1/laws?id=eq.${id}&select=headline`, { headers: SB, cache: 'no-store' }).then(r => r.json()).then(x => x?.[0]?.headline as string | null).catch(() => null)
    : null

  const fonts = await getCardFonts()
  if (!law) {
    // fallback: brand lockup
    return new ImageResponse(
      (<div style={{ width: '100%', height: '100%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'IBM Plex Sans', fontSize: 64, color: C.navy }}>LaButoane</div>),
      { width: 1200, height: 630, fonts })
  }
  const mapped = mapLawToCard(law, [], null)
  const accent = categoryColor(law.law_category) ?? C.navy
  const hero = (headline || law.title || law.code).trim()
  const heroSize = hero.length <= 40 ? 62 : hero.length <= 70 ? 50 : hero.length <= 110 ? 40 : 34
  const summary = (law.summary ?? '').trim()

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: 'flex', flexDirection: 'column', background: '#FFFFFF', color: C.text, fontFamily: 'IBM Plex Sans', padding: '56px 64px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ display: 'flex', width: 12, height: 12, borderRadius: 3, background: accent }} />
          <div style={{ display: 'flex', fontFamily: 'IBM Plex Mono', fontSize: 22, letterSpacing: 2, color: C.faint }}>{mapped.lawCode}</div>
          {law.law_category && <div style={{ display: 'flex', fontSize: 18, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: 1.5 }}>{law.law_category}</div>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
          <div style={{ display: 'flex', fontFamily: 'Plex Display', fontSize: heroSize, lineHeight: 1.08, color: C.text }}>{hero}</div>
          {summary && (
            <div style={{ display: 'flex', fontSize: 24, lineHeight: 1.35, color: C.text, opacity: 0.62, marginTop: 20 }}>
              {summary.length > 180 ? summary.slice(0, 177).trimEnd() + '…' : summary}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: C.hair, paddingTop: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ display: 'flex', background: mapped.statusColor, color: '#fff', fontSize: 16, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', padding: '8px 18px', borderRadius: 3 }}>{mapped.statusLabel}</div>
            {mapped.dateLine && <div style={{ display: 'flex', fontSize: 18, color: C.text, opacity: 0.7 }}>{mapped.dateLine}</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="34" height="34" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#171A1F" /><rect x="11" y="11" width="18" height="18" rx="6" fill="#2EA871" /><rect x="35" y="11" width="18" height="18" rx="6" fill="#E3A23C" /><rect x="11" y="35" width="18" height="18" rx="6" fill="#EE7B5E" /><rect x="35" y="35" width="18" height="18" rx="6" fill="#4E86D8" /></svg>
            <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 28, color: C.navy }}><span style={{ fontWeight: 400 }}>La</span><span style={{ fontWeight: 700 }}>Butoane</span></div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts },
  )
}
