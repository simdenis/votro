// Shared building blocks for every IG card (v2). One header, one footer, one
// status chip, one type scale — so cards stop drifting apart one copy at a time.
//
// The type floor comes from the phone: Instagram shows a 1080px image about
// 390pt wide (×0.36), and a story frame shrinks a 4:5 card a further ×0.93.
// So on a feed card 22px ≈ 8pt is the smallest fine print, 30px ≈ 11pt is the
// smallest text meant to be read. Satori markup: inline styles only,
// display:flex on every box with more than one child.

export const C = {
  bg: '#FFFFFF',
  ink: '#171A1F',
  slate: '#3D4759',
  muted: '#6E7480',
  hair: '#E7E9EC',
  paper: '#F5F6F8',
  for: '#2EA871',
  forDark: '#1F7A51',
  against: '#EE7B5E',
  againstDark: '#C25539',
  abstain: '#E3A23C',
  abstainDark: '#B27A24',
  info: '#4E86D8',
  notVoted: '#9AA0AA',
  absent: '#D8DBE0',
  storyGround: '#EDEFF1',
}

export const F = { display: 'Plex Display', sans: 'IBM Plex Sans', mono: 'IBM Plex Mono' }

/** px sizes on a 1080-wide canvas. Nothing a reader needs goes below `small`. */
export const T = {
  fine: 22,     // footer source, captions under charts
  small: 26,    // codes, dates, labels
  body: 32,     // running text
  lead: 38,     // the sentence that explains the card
  kicker: 22,   // mono uppercase header
}

export const GUTTER = 64

export type Tone = 'for' | 'against' | 'neutral' | 'tacit'

const TONE: Record<Tone, { bg: string; ink: string; key: string }> = {
  // dark fills so white text holds 4.5:1; tacit amber takes ink text instead
  for: { bg: C.forDark, ink: '#FFFFFF', key: '#145238' },
  against: { bg: C.againstDark, ink: '#FFFFFF', key: '#8E3D29' },
  neutral: { bg: C.ink, ink: '#FFFFFF', key: '#000000' },
  tacit: { bg: C.abstain, ink: C.ink, key: C.abstainDark },
}

export function toneColor(t: Tone): string {
  return t === 'tacit' ? C.abstainDark : TONE[t].bg
}

export function StatusChip({ label, tone, size = 'm' }: { label: string; tone: Tone; size?: 'm' | 'l' }) {
  const t = TONE[tone]
  const big = size === 'l'
  return (
    <div style={{
      display: 'flex', background: t.bg, color: t.ink, fontFamily: F.sans, fontWeight: 600,
      fontSize: big ? 30 : 24, letterSpacing: big ? 4 : 3, textTransform: 'uppercase',
      padding: big ? '16px 34px' : '12px 26px', borderRadius: 4, boxShadow: `0 5px 0 ${t.key}`,
    }}>{label}</div>
  )
}

export function Glyph({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#171A1F" /><rect x="11" y="11" width="18" height="18" rx="6" fill="#2EA871" /><rect x="35" y="11" width="18" height="18" rx="6" fill="#E3A23C" /><rect x="11" y="35" width="18" height="18" rx="6" fill="#EE7B5E" /><rect x="35" y="35" width="18" height="18" rx="6" fill="#4E86D8" /></svg>
  )
}

export function Lockup({ size = 40 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(size * 0.32) }}>
      <Glyph size={size} />
      <div style={{ display: 'flex', alignItems: 'baseline', fontFamily: F.sans, fontSize: Math.round(size * 0.78), letterSpacing: '-0.015em', color: C.ink }}>
        <span style={{ fontWeight: 400 }}>La</span><span style={{ fontWeight: 700 }}>Butoane</span>
      </div>
    </div>
  )
}

/** Mono kicker row + hairline. `right` = a date range or a slide counter. */
export function CardHeader({ kicker, right }: { kicker: string; right?: string | null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `40px ${GUTTER}px 24px` }}>
        <div style={{ display: 'flex', fontFamily: F.mono, fontSize: T.kicker, letterSpacing: 3, textTransform: 'uppercase', color: C.muted }}>{kicker}</div>
        {right ? <div style={{ display: 'flex', fontFamily: F.mono, fontSize: T.kicker, letterSpacing: 1, color: C.muted }}>{right}</div> : null}
      </div>
      <div style={{ display: 'flex', height: 1, margin: `0 ${GUTTER}px`, background: C.hair }} />
    </div>
  )
}

/** One footer for every card: handle + source left, lockup right. */
export function CardFooter({ source = 'surse: senat.ro · cdep.ro' }: { source?: string | null }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, padding: `18px ${GUTTER}px`, borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: C.hair }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
        <div style={{ display: 'flex', fontFamily: F.mono, fontSize: T.fine, fontWeight: 500, color: C.ink }}>@la.butoane</div>
        {source ? <div style={{ display: 'flex', fontFamily: F.mono, fontSize: 20, color: C.muted }}>{source}</div> : null}
      </div>
      <Lockup size={40} />
    </div>
  )
}

/** Which way each party's present members mostly voted — the one-line reading
 *  of a party breakdown. Parties with nobody present are left out. */
export function partyLines(parties: { name: string; for: number; against: number; abstain: number }[]) {
  const out: Record<'for' | 'against' | 'abstain', string[]> = { for: [], against: [], abstain: [] }
  for (const p of parties) {
    const top = Math.max(p.for, p.against, p.abstain)
    if (top === 0) continue
    const k = p.for === top ? 'for' : p.against === top ? 'against' : 'abstain'
    out[k].push(p.name)
  }
  return out
}

/** Cut long official titles at a word boundary — a story has room for two lines. */
export function clip(s: string, max: number): string {
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:.\s]+$/, '') + '…'
}
