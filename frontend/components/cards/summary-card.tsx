// 1080×1080 "Pe scurt" card — the AI law summary as the hero, for IG posts.
// Same brand language as LawCard/VoteCard.

export interface SummaryCardData {
  lawCode: string
  lawTitle: string
  category: string | null
  year: number
  summary: string
  statusLabel: string
  statusColor: string
  dateLine: string | null
}

const C = {
  bg: '#fafaf8',
  text: '#0a0a14',
  navy: '#0f2464',
  hair: '#e6e5e1',
}
const SERIF = 'DM Serif Display'
const SANS = 'DM Sans'

/** Summaries are ≤ ~50 words, but shrink gracefully anyway. */
function summaryFont(len: number): number {
  if (len <= 140) return 50
  if (len <= 220) return 44
  if (len <= 300) return 39
  if (len <= 400) return 34
  return 30
}

/** Full title, sized down as it grows so it always fits — never truncated. */
function titleFont(len: number): number {
  if (len <= 90) return 25
  if (len <= 150) return 22
  if (len <= 230) return 19
  if (len <= 340) return 17
  return 15
}

export function SummaryCard({ data }: { data: SummaryCardData }) {
  const title = data.lawTitle

  return (
    <div style={{ width: 1080, height: 1080, display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: SANS }}>
      <div style={{ display: 'flex', height: 12 }}>
        <div style={{ flex: 1, background: '#002B7F' }} />
        <div style={{ flex: 1, background: '#FCD116' }} />
        <div style={{ flex: 1, background: '#CE1126' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '36px 64px 22px' }}>
        <div style={{ fontFamily: SERIF, fontSize: 52, color: C.navy, letterSpacing: '-1.5px', lineHeight: 1 }}>VotRO</div>
        <div style={{ display: 'flex', fontSize: 16, letterSpacing: 3, textTransform: 'uppercase', opacity: 0.55 }}>{`PE SCURT · ${data.year}`}</div>
      </div>
      <div style={{ display: 'flex', height: 1, margin: '0 64px', background: C.hair }} />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '42px 64px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <div style={{ display: 'flex', fontSize: 15, fontWeight: 500, color: C.navy, letterSpacing: 4, textTransform: 'uppercase' }}>{data.lawCode}</div>
          {data.category && (
            <div style={{ display: 'flex', fontSize: 13, color: C.text, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1.5 }}>{data.category}</div>
          )}
        </div>

        {/* Full official title, quiet — the summary is the hero */}
        <div style={{ display: 'flex', fontSize: titleFont(title.length), lineHeight: 1.35, color: C.text, opacity: 0.72 }}>{title}</div>

        {/* The plain-language summary, slightly above vertical center */}
        <div style={{ display: 'flex', flexGrow: 1, minHeight: 24 }} />
        <div style={{ display: 'flex' }}>
          <div style={{ display: 'flex', width: 5, borderRadius: 3, background: C.navy, marginRight: 30, flexShrink: 0 }} />
          <div style={{ display: 'flex', fontFamily: SERIF, fontSize: summaryFont(data.summary.length), lineHeight: 1.24, color: C.text }}>
            {data.summary}
          </div>
        </div>
        <div style={{ display: 'flex', flexGrow: 1.6, minHeight: 24 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginBottom: 34 }}>
          <div style={{ display: 'flex', background: data.statusColor, color: '#fff', fontSize: 18, fontWeight: 600, letterSpacing: 4, textTransform: 'uppercase', padding: '11px 30px', borderRadius: 3 }}>
            {data.statusLabel}
          </div>
          {data.dateLine && <div style={{ display: 'flex', fontSize: 17, color: C.text, opacity: 0.8 }}>{data.dateLine}</div>}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '18px 64px', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: C.hair }}>
        <div style={{ display: 'flex', fontSize: 14, fontWeight: 600, color: C.navy, opacity: 0.62 }}>@vot.romania</div>
        <div style={{ display: 'flex', fontSize: 12, opacity: 0.55 }}>rezumat generat automat · sursă: expunerea de motive</div>
      </div>
    </div>
  )
}
