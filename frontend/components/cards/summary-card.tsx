// 1080×1350 (4:5) "Pe scurt" card — the AI law summary as the hero, for IG posts.
// Same brand language as LawCard/VoteCard.

import { categoryColor } from '@/lib/category-colors'

export interface SummaryCardData {
  lawCode: string
  lawTitle: string
  category: string | null
  year: number
  summary: string
  /** Catchy AI headline (laws.headline) — the eye-catching hero when present. */
  headline?: string | null
  statusLabel: string
  statusColor: string
  dateLine: string | null
  /** e.g. "Inițiativă: Guvernul României" / "Inițiativă: 64 de parlamentari AUR" */
  initiatorLine?: string | null
}

const C = {
  bg: '#FFFFFF',
  text: '#171A1F',
  navy: '#171A1F',
  hair: '#E7E9EC',
}
const SERIF = 'Plex Display'   // IBM Plex Sans 700 (see og-fonts)
const SANS = 'IBM Plex Sans'
const MONO = 'IBM Plex Mono'

/** Summaries are ≤ ~50 words, but shrink gracefully anyway. */
function summaryFont(len: number): number {
  if (len <= 140) return 50
  if (len <= 220) return 44
  if (len <= 300) return 39
  if (len <= 400) return 34
  return 30
}

/** Catchy headline hero — the biggest thing on the card, sized to fit. */
function headlineFont(len: number): number {
  if (len <= 32) return 76
  if (len <= 50) return 64
  if (len <= 72) return 54
  if (len <= 100) return 46
  return 40
}

export function SummaryCard({ data }: { data: SummaryCardData }) {
  const title = data.lawTitle
  const catColor = categoryColor(data.category) ?? C.navy
  const headline = data.headline?.trim() || null

  return (
    <div style={{ width: 1080, height: 1350, display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: SANS }}>

      <div style={{ display: 'flex', alignItems: 'center', padding: '36px 64px 22px' }}>
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 16, letterSpacing: 2.5, textTransform: 'uppercase', color: '#6E7480' }}>{`PE SCURT · ${data.year}`}</div>
      </div>
      <div style={{ display: 'flex', height: 1, margin: '0 64px', background: C.hair }} />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '42px 64px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: headline ? 22 : 12 }}>
          <div style={{ display: 'flex', fontSize: 15, fontWeight: 500, color: C.navy, letterSpacing: 4, textTransform: 'uppercase' }}>{data.lawCode}</div>
          {data.category && (
            <div style={{ display: 'flex', fontSize: 14, fontWeight: 600, color: catColor, textTransform: 'uppercase', letterSpacing: 1.5 }}>{data.category}</div>
          )}
        </div>

        {headline ? (
          // flexShrink:0 so the tall headline block isn't compressed by the
          // column's flexGrow spacers below (that collapse overlapped the title)
          <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            {/* Catchy headline = the hero; official title tiny below it.
                Leaf text divs are block-flow (no display:flex): a flex leaf with
                large wrapping text collapses to ~0 height in satori and the next
                line overlaps it. */}
            <div style={{ fontFamily: SERIF, fontSize: headlineFont(headline.length), lineHeight: 1.12, color: C.text }}>{headline}</div>
            <div style={{ fontSize: 17, lineHeight: 1.3, color: C.text, opacity: 0.5, marginTop: 16 }}>{title}</div>
          </div>
        ) : (
          /* fallback (no AI headline yet): official title quiet, summary is hero */
          <div style={{ display: 'flex', fontSize: title.length <= 150 ? 29 : 22, lineHeight: 1.35, color: C.text, opacity: 0.72 }}>{title}</div>
        )}

        {/* The plain-language summary, slightly above vertical center */}
        <div style={{ display: 'flex', flexGrow: 1, minHeight: 24 }} />
        <div style={{ display: 'flex', flexShrink: 0 }}>
          <div style={{ display: 'flex', width: 5, borderRadius: 3, background: catColor, marginRight: 30, flexShrink: 0 }} />
          <div style={{ display: 'flex', fontFamily: SERIF, fontSize: summaryFont(data.summary.length), lineHeight: 1.24, color: C.text }}>
            {data.summary}
          </div>
        </div>
        <div style={{ display: 'flex', flexGrow: 1.6, minHeight: 24 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginBottom: data.initiatorLine ? 14 : 34 }}>
          <div style={{ display: 'flex', background: data.statusColor, color: '#fff', fontSize: 18, fontWeight: 600, letterSpacing: 4, textTransform: 'uppercase', padding: '11px 30px', borderRadius: 3 }}>
            {data.statusLabel}
          </div>
          {data.dateLine && <div style={{ display: 'flex', fontSize: 17, color: C.text, opacity: 0.8 }}>{data.dateLine}</div>}
        </div>
        {data.initiatorLine && (
          <div style={{ display: 'flex', fontSize: 19, color: C.text, opacity: 0.75, marginBottom: 34 }}>
            {data.initiatorLine}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 64px', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: C.hair }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <div style={{ display: 'flex', fontFamily: MONO, fontSize: 14, fontWeight: 500, color: '#171A1F' }}>@la.butoane</div>
          <div style={{ display: 'flex', fontFamily: MONO, fontSize: 12, color: '#6E7480' }}>rezumat AI al argumentelor inițiatorilor · sursă: expunerea de motive</div>
        </div>
        {/* logo lives bottom-right — the IG profile picture already brands the top */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="34" height="34" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#171A1F" /><rect x="11" y="11" width="18" height="18" rx="6" fill="#2EA871" /><rect x="35" y="11" width="18" height="18" rx="6" fill="#E3A23C" /><rect x="11" y="35" width="18" height="18" rx="6" fill="#EE7B5E" /><rect x="35" y="35" width="18" height="18" rx="6" fill="#4E86D8" /></svg>
          <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 26, letterSpacing: '-0.015em', color: '#171A1F' }}>
            <span style={{ fontWeight: 400 }}>La</span><span style={{ fontWeight: 700 }}>Butoane</span>
          </div>
        </div>
      </div>
    </div>
  )
}
