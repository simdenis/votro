// ── Data model (handoff) ──────────────────────────────────────────────────────
export interface PartyVote {
  name: string
  for: number
  against: number
  abstain: number
  absent: number
}

export interface VoteCardData {
  lawCode: string
  lawTitle: string
  chamber: 'SENAT' | 'CAMERĂ'
  result: 'ADOPTAT' | 'RESPINS'
  year: number
  votesFor: number
  votesAgainst: number
  votesAbstain: number
  votesAbsent: number
  source: 'senat.ro' | 'cdep.ro'
  parties: PartyVote[]
}

// ── Tokens ─────────────────────────────────────────────────────────────────────
const C = {
  bg: '#fafaf8',
  text: '#0a0a14',
  navy: '#0f2464',
  for: '#1a7a42',
  against: '#c4362e',
  abstain: '#8a7fb0',
  absentDot: '#d0cfc8',
  absentNum: '#9e9d97',
  hair: '#e6e5e1', // hex hairline — Satori rejects rgba in border shorthands
}
const SERIF = 'DM Serif Display'
const SANS = 'DM Sans'

// ── Parliament arc (handoff algorithm) ─────────────────────────────────────────
export function computeArcDots(forN: number, againstN: number, abstainN: number, absentN: number) {
  const total = forN + againstN + abstainN + absentN
  if (!total) return [] as { x: number; y: number; color: string }[]

  const cx = 476, cy = 302
  const innerR = 130, rowStep = 32, numRows = 6

  const radii: number[] = []
  for (let i = 0; i < numRows; i++) radii.push(innerR + i * rowStep) // 130..290
  const sumR = radii.reduce((a, b) => a + b, 0)

  const seats = radii.map(r => Math.round((total * r) / sumR))
  seats[numRows - 1] += total - seats.reduce((a, b) => a + b, 0) // fix rounding

  const colors = [
    ...Array(Math.max(0, forN)).fill(C.for),
    ...Array(Math.max(0, againstN)).fill(C.against),
    ...Array(Math.max(0, abstainN)).fill(C.abstain),
    ...Array(Math.max(0, absentN)).fill(C.absentDot),
  ]

  const dots: { x: number; y: number; color: string }[] = []
  let ci = 0
  for (let row = 0; row < numRows; row++) {
    const r = radii[row]
    const n = seats[row]
    for (let i = 0; i < n; i++) {
      const angle = n > 1 ? Math.PI * (1 - i / (n - 1)) : Math.PI / 2
      const x = cx + r * Math.cos(angle)
      const y = cy - r * Math.sin(angle)
      dots.push({ x, y, color: colors[ci] || C.absentDot })
      ci++
    }
  }
  return dots
}

// ── Component ───────────────────────────────────────────────────────────────────
export function VoteCard({ data }: { data: VoteCardData }) {
  const total = data.votesFor + data.votesAgainst + data.votesAbstain + data.votesAbsent
  const dots = computeArcDots(data.votesFor, data.votesAgainst, data.votesAbstain, data.votesAbsent)
  const badgeBg = data.result === 'ADOPTAT' ? C.for : C.against

  const cols: { value: number; label: string; color: string }[] = [
    { value: data.votesFor, label: 'pentru', color: C.for },
    { value: data.votesAgainst, label: 'împotrivă', color: C.against },
    { value: data.votesAbstain, label: 'abțineri', color: C.abstain },
    { value: data.votesAbsent, label: 'absenți', color: C.absentNum },
  ]

  const seg = (count: number, color: string) =>
    count > 0 ? <div style={{ flexGrow: count, flexShrink: 1, flexBasis: 0, background: color }} /> : null

  return (
    <div style={{ width: 1080, height: 1080, display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: SANS }}>
      {/* Tricolor */}
      <div style={{ display: 'flex', height: 12 }}>
        <div style={{ flex: 1, background: '#002B7F' }} />
        <div style={{ flex: 1, background: '#FCD116' }} />
        <div style={{ flex: 1, background: '#CE1126' }} />
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '36px 64px 22px' }}>
        <div style={{ fontFamily: SERIF, fontSize: 52, color: C.navy, letterSpacing: '-1.5px', lineHeight: 1 }}>VotRO</div>
        <div style={{ display: 'flex', fontSize: 16, letterSpacing: 3, textTransform: 'uppercase', opacity: 0.38 }}>{`${data.chamber} · ${data.year}`}</div>
      </div>
      <div style={{ display: 'flex', height: 1, margin: '0 64px', background: C.hair }} />

      {/* Content */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '36px 64px 0' }}>
        <div style={{ display: 'flex', fontSize: 14, fontWeight: 500, color: C.navy, letterSpacing: 5, textTransform: 'uppercase', marginBottom: 12 }}>{data.lawCode}</div>
        <div style={{ fontFamily: SERIF, fontSize: 46, lineHeight: 1.12, color: C.text, marginBottom: 18, maxHeight: 160, overflow: 'hidden' }}>{data.lawTitle}</div>

        {/* Parliament arc */}
        <div style={{ display: 'flex', width: '100%', height: 308, overflow: 'hidden', marginBottom: 14 }}>
          <svg width={952} height={308} viewBox="0 0 952 308">
            {dots.map((d, i) => (
              <circle key={i} cx={d.x} cy={d.y} r={4.5} fill={d.color} />
            ))}
          </svg>
        </div>

        {/* Badge + total */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginBottom: 20 }}>
          <div style={{ display: 'flex', background: badgeBg, color: '#fff', fontSize: 18, fontWeight: 600, letterSpacing: 4, textTransform: 'uppercase', padding: '11px 30px', borderRadius: 3 }}>
            {data.result}
          </div>
          <div style={{ display: 'flex', fontSize: 15, opacity: 0.3 }}>{`${total} parlamentari`}</div>
        </div>

        {/* 4-column breakdown */}
        <div style={{ display: 'flex' }}>
          {cols.map((c, i) => (
            <div
              key={c.label}
              style={{
                display: 'flex', flexDirection: 'column', flex: 1, padding: '0 20px',
                borderLeftWidth: i > 0 ? 1 : 0, borderLeftStyle: 'solid', borderLeftColor: C.hair,
              }}
            >
              <div style={{ display: 'flex', fontFamily: SERIF, fontSize: 38, lineHeight: 1, color: c.color }}>{c.value}</div>
              <div style={{ display: 'flex', fontSize: 11, opacity: 0.3, textTransform: 'uppercase', letterSpacing: 2.5, marginTop: 5 }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Spacer */}
        <div style={{ display: 'flex', flex: 1, minHeight: 8 }} />

        {/* Vot pe partide */}
        <div style={{ display: 'flex', height: 1, background: C.hair, marginBottom: 14 }} />
        <div style={{ display: 'flex', fontSize: 11, fontWeight: 600, color: C.navy, letterSpacing: 4, textTransform: 'uppercase', opacity: 0.65, marginBottom: 10 }}>Vot pe partide</div>
        {data.parties.slice(0, 5).map(p => {
          const t = p.for + p.against + p.abstain + p.absent
          return (
            <div key={p.name} style={{ display: 'flex', alignItems: 'center', height: 38 }}>
              <div style={{ display: 'flex', width: 54, justifyContent: 'flex-end', fontSize: 13, fontWeight: 600, opacity: 0.5, paddingRight: 10 }}>{p.name}</div>
              <div style={{ display: 'flex', flexGrow: 1, flexShrink: 1, flexBasis: 0, height: 14, borderRadius: 2, overflow: 'hidden', background: C.hair }}>
                {seg(p.for, C.for)}
                {seg(p.against, C.against)}
                {seg(p.abstain, C.abstain)}
                {seg(p.absent, C.absentDot)}
              </div>
              <div style={{ display: 'flex', width: 34, fontSize: 11, opacity: 0.26, paddingLeft: 8 }}>{t}</div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '18px 64px', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: C.hair, marginTop: 12 }}>
        <div style={{ display: 'flex', fontSize: 14, fontWeight: 600, color: C.navy, opacity: 0.62 }}>votro.ro</div>
        <div style={{ display: 'flex', fontSize: 12, opacity: 0.22 }}>{`sursă: ${data.source}`}</div>
      </div>
    </div>
  )
}
