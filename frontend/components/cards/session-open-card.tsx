import { CardHeader, CardFooter } from './kit'
// 1080×1350 (4:5) Instagram card — who did not vote at a session opening.
// Same brand language as ShameCard / VoteCard / WeekCard.
//
// The hook is the headline count plus per-party bars; the named list stays on the
// /voturi pages the caption links to. Bars are scaled against 100% of a party's
// own seats (not against the leading party), so a short bar means "few of theirs
// were missing" rather than "fewer than the next one".

export interface PartyRow {
  abbr: string
  color: string
  absent: number
  seats: number
  /** Rounded absent/seats, 0-100. Precomputed so the card does no arithmetic. */
  pct: number
}

export interface SessionOpenCardData {
  /** Kicker, e.g. "27 iulie 2026 · camera deputaților" */
  dateLabel: string
  absent: number
  total: number
  /** Under the number, e.g. "deputați n-au votat la deschiderea sesiunii extraordinare" */
  headline: string
  /** Bottom line: how to read the bars, plus any fairness caveat for this count. */
  note: string
  parties: PartyRow[]
}

const C = {
  bg: '#FFFFFF',
  text: '#171A1F',
  against: '#EE7B5E',
  hair: '#E7E9EC',
  track: '#F1F3F5',
  faint: '#6E7480',
}
const SERIF = 'Plex Display' // IBM Plex Sans 700 (see og-fonts)
const SANS = 'IBM Plex Sans'
const MONO = 'IBM Plex Mono'

export function SessionOpenCard({ data }: { data: SessionOpenCardData }) {
  // 9 groups fit at the roomy size; a fuller chamber tightens the rows.
  const compact = data.parties.length > 9

  return (
    <div style={{ width: 1080, height: 1350, display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: SANS }}>

      <CardHeader kicker={data.dateLabel} />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '34px 64px 20px' }}>

        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <div style={{ display: 'flex', fontFamily: SERIF, fontSize: 168, lineHeight: 1, color: C.against }}>{`${data.absent}`}</div>
          <div style={{ display: 'flex', fontFamily: SERIF, fontSize: 62, lineHeight: 1, color: C.against, marginLeft: 18 }}>{`din ${data.total}`}</div>
        </div>

        <div style={{ display: 'flex', fontSize: 38, fontWeight: 700, lineHeight: 1.2, marginTop: 18 }}>{data.headline}</div>

        <div style={{ display: 'flex', height: 1, marginTop: 34, marginBottom: 8, background: C.hair }} />

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
          {data.parties.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', padding: compact ? '7px 0' : '11px 0' }}>
              <div style={{ display: 'flex', width: 86, fontFamily: MONO, fontSize: compact ? 22 : 24, fontWeight: 500 }}>{p.abbr}</div>

              {/* track + fill: percentage of the party's OWN seats */}
              <div style={{ display: 'flex', flex: 1, height: compact ? 22 : 28, background: C.track, borderRadius: 4, marginRight: 18 }}>
                <div style={{ display: 'flex', width: `${p.pct}%`, height: '100%', background: p.color, borderRadius: 4 }} />
              </div>

              <div style={{ display: 'flex', width: 96, fontFamily: MONO, fontSize: compact ? 20 : 22, color: C.faint }}>{`${p.absent}/${p.seats}`}</div>
              <div style={{ display: 'flex', width: 74, justifyContent: 'flex-end', alignItems: 'baseline' }}>
                <div style={{ display: 'flex', fontFamily: SERIF, fontSize: compact ? 28 : 34 }}>{`${p.pct}`}</div>
                <div style={{ display: 'flex', fontSize: compact ? 20 : 22, marginLeft: 3 }}>%</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', fontSize: 24, opacity: 0.7, marginTop: 16 }}>{data.note}</div>
      </div>

      <CardFooter source={"sursă: cdep.ro"} />
    </div>
  )
}
