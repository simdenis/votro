import { computeArcDots, type PartyVote } from './vote-card'
import { C, F, T, Lockup, clip, partyLines } from './kit'

// 1080×1920 story for one final vote — designed for 9:16 instead of a 4:5 card
// shrunk into a frame. Read top to bottom in three seconds: what the law does
// (the AI headline, not the official title), what happened (big outcome +
// tally), who voted how (parties by majority), what comes next.

export interface VoteStoryData {
  /** «Senat» / «Camera Deputaților» */
  chamberName: string
  dateLabel: string            // "5 octombrie 2026"
  lawCode: string
  /** laws.headline — falls back to the official title */
  headline: string | null
  lawTitle: string
  /** what the law does, 2–3 sentences (the explainer's rezumat, else the AI summary) */
  summary?: string | null
  result: 'ADOPTAT' | 'RESPINS'
  votesFor: number
  votesAgainst: number
  votesAbstain: number
  votesNotVoted: number
  votesAbsent: number
  parties: PartyVote[]
  /** one plain sentence: «Urmează Camera Deputaților.» / «Merge la Președinte pentru promulgare.» */
  nextLine?: string | null
}

function headlineSize(len: number): number {
  if (len <= 40) return 92
  if (len <= 64) return 80
  if (len <= 90) return 68
  return 58
}

const ROWS = [
  { key: 'for', label: 'Pentru', color: C.for },
  { key: 'against', label: 'Împotrivă', color: C.against },
  { key: 'abstain', label: 'Abținere', color: C.abstain },
] as const

export function VoteStory({ data }: { data: VoteStoryData }) {
  const adopted = data.result === 'ADOPTAT'
  const headline = data.headline?.trim() || clip(data.lawTitle, 90)
  const dots = computeArcDots(data.votesFor, data.votesAgainst, data.votesAbstain, data.votesNotVoted, data.votesAbsent)
  const lines = partyLines(data.parties)
  const tally = [
    { n: data.votesFor, label: 'pentru', color: C.forDark },
    { n: data.votesAgainst, label: 'împotrivă', color: C.againstDark },
    { n: data.votesAbstain, label: 'abțineri', color: C.abstainDark },
  ]

  return (
    <div style={{ width: 1080, height: 1920, display: 'flex', flexDirection: 'column', background: C.bg, color: C.ink, fontFamily: F.sans, padding: '96px 72px 90px' }}>
      <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0 }}><Lockup size={44} /></div>

      <div style={{ display: 'flex', fontFamily: F.mono, fontSize: 28, letterSpacing: 3, textTransform: 'uppercase', color: C.muted, marginTop: 84 }}>
        {`Vot final · ${data.chamberName} · ${data.dateLabel}`}
      </div>
      <div style={{ fontFamily: F.display, fontSize: headlineSize(headline.length), lineHeight: 1.06, color: C.ink, marginTop: 26 }}>{headline}</div>
      {data.summary ? (
        <div style={{ fontSize: 34, lineHeight: 1.36, color: C.slate, marginTop: 26 }}>{clip(data.summary, 260)}</div>
      ) : null}
      <div style={{ display: 'flex', fontSize: T.small, lineHeight: 1.35, color: C.muted, marginTop: 22 }}>
        {data.summary ? data.lawCode : `${data.lawCode} · ${clip(data.lawTitle, 110)}`}
      </div>

      <div style={{ display: 'flex', flexGrow: 1, minHeight: 40 }} />

      {/* outcome */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', fontFamily: F.display, fontSize: 132, lineHeight: 0.9, color: adopted ? C.forDark : C.againstDark }}>
          {adopted ? 'Adoptat' : 'Respins'}
        </div>
        <div style={{ display: 'flex', gap: 34, paddingBottom: 6 }}>
          {tally.map(t => (
            <div key={t.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', fontFamily: F.display, fontSize: 64, lineHeight: 1, color: t.color }}>{`${t.n}`}</div>
              <div style={{ display: 'flex', fontSize: 24, color: C.slate, marginTop: 6 }}>{t.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 44, flexShrink: 0 }}>
        <svg width={data.summary ? 760 : 936} height={data.summary ? 246 : 303} viewBox="0 0 952 308">
          {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={6.5} fill={d.color} />)}
        </svg>
      </div>

      {/* parties, by how most of their present members voted */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 44, flexShrink: 0 }}>
        {ROWS.filter(r => lines[r.key].length > 0).map(r => (
          <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ display: 'flex', width: 22, height: 22, borderRadius: 11, background: r.color, flexShrink: 0 }} />
            <div style={{ display: 'flex', width: 200, fontSize: 32, fontWeight: 600, flexShrink: 0 }}>{r.label}</div>
            <div style={{ display: 'flex', fontSize: 32, color: C.slate }}>{lines[r.key].join(', ')}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexGrow: 1, minHeight: 40 }} />

      {data.nextLine ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, background: C.paper, borderRadius: 12, padding: '28px 34px', flexShrink: 0 }}>
          <svg width="34" height="22" viewBox="0 0 26 16" style={{ flexShrink: 0 }}><path d="M0 8h22M16 2l7 6-7 6" stroke={C.ink} strokeWidth="2.4" fill="none" /></svg>
          <div style={{ display: 'flex', fontSize: T.lead, lineHeight: 1.3, color: C.ink }}>{data.nextLine}</div>
        </div>
      ) : null}

      <div style={{ display: 'flex', justifyContent: 'center', fontFamily: F.mono, fontSize: 26, color: C.muted, letterSpacing: 1, marginTop: 44, flexShrink: 0 }}>
        detalii pe la-butoane.ro
      </div>
    </div>
  )
}
