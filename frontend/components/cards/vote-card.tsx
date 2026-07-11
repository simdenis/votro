import { countNoun } from '@/lib/utils'

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
  /** full vote date, e.g. "10 iunie 2026" */
  dateLabel: string | null
  votesFor: number
  votesAgainst: number
  votesAbstain: number
  /** present but didn't press a button (cdep "nu au votat") */
  votesNotVoted: number
  /** true absentees: chamber seats − participants (0 when seats unknown) */
  votesAbsent: number
  /** total chamber seats, when known — enables "X din Y prezenți" */
  seats: number | null
  source: 'senat.ro' | 'cdep.ro'
  parties: PartyVote[]
}

// ── Tokens ─────────────────────────────────────────────────────────────────────
const C = {
  bg: '#FFFFFF',
  text: '#171A1F',
  navy: '#171A1F',
  for: '#2EA871',
  against: '#EE7B5E',
  abstain: '#E3A23C',
  notVotedDot: '#9AA0AA', // present, didn't vote — darker than true absents
  absentDot: '#D8DBE0',
  absentNum: '#6E7480',
  hair: '#E7E9EC', // hex hairline — Satori rejects rgba in border shorthands
}
const SERIF = 'Plex Display'   // IBM Plex Sans 700 (see og-fonts)
const SANS = 'IBM Plex Sans'
const MONO = 'IBM Plex Mono'

/** Shrink the serif title as it grows so it always fits — never clip it. */
function titleFont(len: number): number {
  if (len <= 70) return 46
  if (len <= 130) return 36
  if (len <= 200) return 30
  if (len <= 300) return 26
  if (len <= 450) return 22
  return 19
}

// ── Parliament arc (handoff algorithm) ─────────────────────────────────────────
export function computeArcDots(forN: number, againstN: number, abstainN: number, notVotedN: number, absentN = 0) {
  const total = forN + againstN + abstainN + notVotedN + absentN
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
    ...Array(Math.max(0, notVotedN)).fill(C.notVotedDot),
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
  const participants = data.votesFor + data.votesAgainst + data.votesAbstain + data.votesNotVoted
  // arc shows the full chamber when we know its size: participants + true absents
  const dots = computeArcDots(data.votesFor, data.votesAgainst, data.votesAbstain, data.votesNotVoted, data.votesAbsent)
  const badgeBg = data.result === 'ADOPTAT' ? C.for : C.against

  const presenceLine = data.seats
    ? `${participants} prezenți din ${data.seats} ${countNoun(data.seats, 'mandat', 'mandate')}`
    : `${participants} ${countNoun(participants, 'parlamentar', 'parlamentari')}`

  const cols: { value: number; label: string; color: string }[] = [
    { value: data.votesFor, label: 'pentru', color: C.for },
    { value: data.votesAgainst, label: 'împotrivă', color: C.against },
    { value: data.votesAbstain, label: 'abțineri', color: C.abstain },
    // present-but-not-voting only exists in Camera data
    ...(data.votesNotVoted > 0 ? [{ value: data.votesNotVoted, label: 'n-au votat', color: C.absentNum }] : []),
    ...(data.votesAbsent > 0 ? [{ value: data.votesAbsent, label: 'absenți', color: C.absentNum }] : []),
  ]

  const seg = (count: number, color: string) =>
    count > 0 ? <div style={{ flexGrow: count, flexShrink: 1, flexBasis: 0, background: color }} /> : null

  return (
    <div style={{ width: 1080, height: 1350, display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: SANS }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '32px 64px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <svg width="46" height="46" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#171A1F" /><rect x="11" y="11" width="18" height="18" rx="6" fill="#2EA871" /><rect x="35" y="11" width="18" height="18" rx="6" fill="#E3A23C" /><rect x="11" y="35" width="18" height="18" rx="6" fill="#EE7B5E" /><rect x="35" y="35" width="18" height="18" rx="6" fill="#4E86D8" /></svg>
          <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 36, letterSpacing: '-0.015em', color: '#171A1F' }}>
            <span style={{ fontWeight: 400 }}>La</span><span style={{ fontWeight: 700 }}>Butoane</span>
          </div>
        </div>
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 14, letterSpacing: 2, textTransform: 'uppercase', color: '#6E7480' }}>{`${data.chamber} · ${data.year}`}</div>
      </div>
      <div style={{ display: 'flex', height: 1, margin: '0 64px', background: C.hair }} />

      {/* Content */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '36px 64px 0' }}>
        <div style={{ display: 'flex', fontSize: 14, fontWeight: 500, color: C.navy, letterSpacing: 5, textTransform: 'uppercase', marginBottom: 12 }}>{data.lawCode}</div>
        <div style={{ fontFamily: SERIF, fontSize: titleFont(data.lawTitle.length), lineHeight: 1.14, color: C.text, marginBottom: 18 }}>{data.lawTitle}</div>

        {/* Spacer — splits the 4:5 slack with its twin below the stats row */}
        <div style={{ display: 'flex', flex: 1, minHeight: 4 }} />

        {/* Parliament arc — scales down when a long title or a full party list
            needs the vertical room (all parties are shown below). */}
        {(() => {
          const arcH = (data.lawTitle.length > 200 || data.parties.length > 6) ? 320 : 400
          const arcW = Math.round(952 * (arcH / 308))
          return (
            <div style={{ display: 'flex', width: '100%', height: arcH, justifyContent: 'center', marginBottom: 14 }}>
              <svg width={arcW} height={arcH} viewBox="0 0 952 308">
                {dots.map((d, i) => (
                  <circle key={i} cx={d.x} cy={d.y} r={4.5} fill={d.color} />
                ))}
              </svg>
            </div>
          )
        })()}

        {/* Badge + total */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginBottom: 20 }}>
          <div style={{ display: 'flex', background: badgeBg, color: '#fff', fontSize: 18, fontWeight: 600, letterSpacing: 4, textTransform: 'uppercase', padding: '11px 30px', borderRadius: 3 }}>
            {data.result}
          </div>
          <div style={{ display: 'flex', fontSize: 15, color: C.text, opacity: 0.8 }}>
            {[data.dateLabel, presenceLine].filter(Boolean).join('  ·  ')}
          </div>
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
              <div style={{ display: 'flex', fontSize: 11, color: C.text, opacity: 0.75, textTransform: 'uppercase', letterSpacing: 2.5, marginTop: 5 }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Spacer */}
        <div style={{ display: 'flex', flex: 1, minHeight: 8 }} />

        {/* Vot pe partide — hidden when there's no breakdown data */}
        {data.parties.length > 0 && (
          <div style={{ display: 'flex', height: 1, background: C.hair, marginBottom: 14 }} />
        )}
        {data.parties.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', fontSize: 11, fontWeight: 600, color: C.navy, letterSpacing: 4, textTransform: 'uppercase' }}>Vot pe partide</div>
            {/* color legend — every hue carries one meaning */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {([['Pentru', C.for], ['Împotrivă', C.against], ['Abțineri', C.abstain], ['Absenți', C.absentDot]] as const).map(([label, color]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ display: 'flex', width: 9, height: 9, borderRadius: 5, background: color }} />
                  <div style={{ display: 'flex', fontSize: 12, color: '#6E7480' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {(() => {
          // Row height shrinks as the party count grows so the full list always
          // fits the 1080px card (satori doesn't scroll — it would just clip).
          const n = data.parties.length
          const rowH = n > 8 ? 26 : n > 6 ? 30 : n > 5 ? 34 : 38
          const barH = rowH < 32 ? 11 : 14
          return data.parties.map(p => {
            const t = p.for + p.against + p.abstain + p.absent
            return (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', height: rowH }}>
                <div style={{ display: 'flex', width: 54, justifyContent: 'flex-end', fontSize: 13, fontWeight: 600, color: C.text, opacity: 0.75, paddingRight: 10 }}>{p.name}</div>
                <div style={{ display: 'flex', flexGrow: 1, flexShrink: 1, flexBasis: 0, height: barH, borderRadius: 2, overflow: 'hidden', background: C.hair }}>
                  {seg(p.for, C.for)}
                  {seg(p.against, C.against)}
                  {seg(p.abstain, C.abstain)}
                  {seg(p.absent, C.absentDot)}
                </div>
                <div style={{ display: 'flex', width: 34, fontSize: 11, color: C.text, opacity: 0.8, paddingLeft: 8 }}>{t}</div>
              </div>
            )
          })
        })()}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '18px 64px', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: C.hair, marginTop: 12 }}>
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 14, fontWeight: 500, color: '#171A1F' }}>@la.butoane</div>
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 12, color: '#6E7480' }}>{`sursă: ${data.source}`}</div>
      </div>
    </div>
  )
}
