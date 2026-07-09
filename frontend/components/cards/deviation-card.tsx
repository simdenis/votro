// 1080×1080 deviation card — who broke party line on a vote, by name.
// Same brand language as VoteCard.

export interface DeviatorRow {
  name: string          // "Prenume NUME"
  partyAbbr: string
  partyColor: string
  choice: string        // 'for' | 'against' | 'abstention' | …
}

export interface DeviationCardData {
  lawCode: string
  lawTitle: string
  chamber: 'SENAT' | 'CAMERĂ'
  year: number
  memberNoun: string    // "deputați" / "senatori" (already pluralized)
  verb: string          // "au votat" / "a votat"
  deviators: DeviatorRow[]
}

const C = {
  bg: '#fafaf8',
  text: '#0a0a14',
  navy: '#0f2464',
  for: '#1a7a42',
  against: '#c4362e',
  abstain: '#8a7fb0',
  deviation: '#b45309',
  hair: '#e6e5e1',
}
const SERIF = 'DM Serif Display'
const SANS = 'DM Sans'

const CHOICE_LABEL: Record<string, string> = {
  for: 'PENTRU', against: 'ÎMPOTRIVĂ', abstention: 'ABȚINERE',
  not_voted: 'NU A VOTAT', absent: 'ABSENT',
}
const CHOICE_COLOR: Record<string, string> = {
  for: C.for, against: C.against, abstention: C.abstain,
  not_voted: '#9e9d97', absent: '#9e9d97',
}

function textOn(bg: string) {
  const h = bg.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#0a0a14' : '#ffffff'
}

/** Shrink the serif title as it grows so it always fits — never clip it. */
function titleFont(len: number): number {
  if (len <= 90) return 34
  if (len <= 160) return 28
  if (len <= 260) return 24
  return 20
}

const MAX_ROWS = 10

export function DeviationCard({ data }: { data: DeviationCardData }) {
  const shown = data.deviators.slice(0, MAX_ROWS)
  const extra = data.deviators.length - shown.length
  const n = data.deviators.length
  // list density adapts: tighter rows when the list is long
  const rowH = shown.length > 7 ? 52 : 62
  const nameSize = shown.length > 7 ? 22 : 25

  return (
    <div style={{ width: 1080, height: 1080, display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: SANS }}>
      <div style={{ display: 'flex', height: 12 }}>
        <div style={{ flex: 1, background: '#002B7F' }} />
        <div style={{ flex: 1, background: '#FCD116' }} />
        <div style={{ flex: 1, background: '#CE1126' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '36px 64px 22px' }}>
        <div style={{ fontFamily: SERIF, fontSize: 52, color: C.navy, letterSpacing: '-1.5px', lineHeight: 1 }}>VotRO</div>
        <div style={{ display: 'flex', fontSize: 16, letterSpacing: 3, textTransform: 'uppercase', opacity: 0.55 }}>{`${data.chamber} · ${data.year}`}</div>
      </div>
      <div style={{ display: 'flex', height: 1, margin: '0 64px', background: C.hair }} />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '38px 64px 0' }}>
        {/* Headline */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, marginBottom: 14 }}>
          <div style={{ display: 'flex', fontFamily: SERIF, fontSize: 130, lineHeight: 0.85, color: C.deviation }}>{n}</div>
          <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 8 }}>
            <div style={{ display: 'flex', fontSize: 30, fontWeight: 600, lineHeight: 1.15 }}>{`${data.memberNoun} ${data.verb}`}</div>
            <div style={{ display: 'flex', fontSize: 30, fontWeight: 600, lineHeight: 1.15, color: C.deviation }}>împotriva propriului partid</div>
          </div>
        </div>

        {/* Law reference */}
        <div style={{ display: 'flex', fontSize: 14, fontWeight: 500, color: C.navy, letterSpacing: 5, textTransform: 'uppercase', marginBottom: 8 }}>{data.lawCode}</div>
        <div style={{ fontFamily: SERIF, fontSize: titleFont(data.lawTitle.length), lineHeight: 1.16, marginBottom: 24 }}>{data.lawTitle}</div>

        {/* Deviator list */}
        <div style={{ display: 'flex', flexDirection: 'column', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: C.hair }}>
          {shown.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', height: rowH, borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: C.hair }}>
              <div style={{ display: 'flex', width: 8, height: 8, borderRadius: 4, background: C.deviation, marginRight: 16 }} />
              <div style={{ display: 'flex', fontSize: nameSize, fontWeight: 500, flexGrow: 1, flexShrink: 1 }}>{d.name}</div>
              <div style={{ display: 'flex', background: d.partyColor, color: textOn(d.partyColor), fontSize: 15, fontWeight: 600, padding: '4px 12px', borderRadius: 4, marginRight: 18 }}>{d.partyAbbr}</div>
              <div style={{ display: 'flex', width: 150, justifyContent: 'flex-end', fontSize: 16, fontWeight: 700, letterSpacing: 1.5, color: CHOICE_COLOR[d.choice] ?? C.text }}>
                {CHOICE_LABEL[d.choice] ?? d.choice}
              </div>
            </div>
          ))}
          {extra > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', height: 46, fontSize: 17, opacity: 0.7 }}>{`+ încă ${extra} — lista completă pe site (link în bio)`}</div>
          )}
        </div>

        <div style={{ display: 'flex', flex: 1 }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '18px 64px', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: C.hair }}>
        <div style={{ display: 'flex', fontSize: 14, fontWeight: 600, color: C.navy, opacity: 0.62 }}>@vot.romania</div>
        <div style={{ display: 'flex', fontSize: 12, opacity: 0.55 }}>deviere = vot diferit de majoritatea propriului partid</div>
      </div>
    </div>
  )
}
