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
  /** the count in the caption, when it is more than the laws shown (a law voted twice, >9 laws) */
  count?: number
}

const COPY = {
  votate: { kicker: 'Săptămâna trecută', title: 'Ce a votat Parlamentul', one: 'vot final adoptat', many: 'voturi finale adoptate' },
  parlament: { kicker: 'Săptămâna aceasta', title: 'Ce a trecut de Parlament', one: 'lege trimisă la promulgare', many: 'legi trimise la promulgare' },
  promulgate: { kicker: 'Săptămâna aceasta', title: 'Ce s-a făcut lege', one: 'lege promulgată', many: 'legi promulgate' },
}

export function WeekCoverCard({ data }: { data: WeekCoverCardData }) {
  const k = COPY[data.kind]
  const shown = data.items.slice(0, 9)
  const n = Math.max(data.count ?? 0, data.items.length)
  const more = n - shown.length
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
          {more > 0 ? (
            <div style={{ display: 'flex', padding: '14px 0 0 62px', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: C.hair, fontSize: rowSize, color: C.muted }}>
              {`și încă ${more} în descriere`}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexGrow: 1, minHeight: 20 }} />

      </div>

      <CardFooter />
    </div>
  )
}
