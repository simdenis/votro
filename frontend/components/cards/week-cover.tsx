import { C, F, T, CardHeader, CardFooter, clip } from './kit'

// Cover of a multi-law carousel. v2 lists what is inside — every law's headline
// in slide order — so the post is understood from the cover alone and the
// count can't drift from the slides.

export interface WeekCoverItem { code: string; headline: string }

export interface WeekCoverCardData {
  kind: 'votate' | 'parlament' | 'promulgate'
  /** «5–11 octombrie 2026» */
  range: string
  /** in slide order; the cover shows up to 9 */
  items: WeekCoverItem[]
}

const COPY = {
  votate: { kicker: 'Săptămâna trecută', title: 'Ce a votat Parlamentul', one: 'vot final adoptat', many: 'voturi finale adoptate' },
  parlament: { kicker: 'Săptămâna aceasta', title: 'Ce a trecut de Parlament', one: 'lege trimisă la promulgare', many: 'legi trimise la promulgare' },
  promulgate: { kicker: 'Săptămâna aceasta', title: 'Ce s-a făcut lege', one: 'lege promulgată', many: 'legi promulgate' },
}

export function WeekCoverCard({ data }: { data: WeekCoverCardData }) {
  const k = COPY[data.kind]
  const n = data.items.length
  const shown = data.items.slice(0, 9)
  const rowSize = shown.length > 7 ? 28 : 32

  return (
    <div style={{ width: 1080, height: 1350, display: 'flex', flexDirection: 'column', background: C.bg, color: C.ink, fontFamily: F.sans }}>
      <CardHeader kicker={k.kicker} right={data.range} />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '44px 64px 34px' }}>
        <div style={{ fontFamily: F.display, fontSize: 76, lineHeight: 1.04, flexShrink: 0 }}>{k.title}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 18, flexShrink: 0 }}>
          <div style={{ display: 'flex', fontFamily: F.display, fontSize: 76, lineHeight: 1, color: C.forDark }}>{`${n}`}</div>
          <div style={{ display: 'flex', fontSize: T.lead, color: C.slate }}>{n === 1 ? k.one : k.many}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 40, flexShrink: 0 }}>
          {shown.map((it, i) => (
            <div key={it.code} style={{ display: 'flex', alignItems: 'baseline', gap: 22, padding: '14px 0', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: C.hair }}>
              {/* the slide this law is on — the cover is slide 1 */}
              <div style={{ display: 'flex', width: 40, flexShrink: 0, fontFamily: F.mono, fontSize: T.small, color: C.muted }}>{`${i + 2}`}</div>
              <div style={{ display: 'flex', fontSize: rowSize, lineHeight: 1.25, color: C.ink }}>{clip(it.headline, 58)}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexGrow: 1, minHeight: 20 }} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: C.forDark, borderRadius: 999, padding: '14px 30px' }}>
            <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, color: '#fff', letterSpacing: 1 }}>Glisează</div>
            <svg width="46" height="22" viewBox="0 0 46 22" fill="none">
              <path d="M4 4l7 7-7 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
              <path d="M18 4l7 7-7 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />
              <path d="M32 4l7 7-7 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>

      <CardFooter />
    </div>
  )
}
