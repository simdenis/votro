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

      <div style={{ display: 'flex', alignItems: 'center', padding: '36px 64px 22px' }}>
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 16, letterSpacing: 2.5, textTransform: 'uppercase', color: C.faint }}>{data.dateLabel}</div>
      </div>
      <div style={{ display: 'flex', height: 1, margin: '0 64px', background: C.hair }} />

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
              <div style={{ display: 'flex', width: 86, fontFamily: MONO, fontSize: compact ? 19 : 22, fontWeight: 500 }}>{p.abbr}</div>

              {/* track + fill: percentage of the party's OWN seats */}
              <div style={{ display: 'flex', flex: 1, height: compact ? 22 : 28, background: C.track, borderRadius: 4, marginRight: 18 }}>
                <div style={{ display: 'flex', width: `${p.pct}%`, height: '100%', background: p.color, borderRadius: 4 }} />
              </div>

              <div style={{ display: 'flex', width: 96, fontFamily: MONO, fontSize: compact ? 15 : 17, color: C.faint }}>{`${p.absent}/${p.seats}`}</div>
              <div style={{ display: 'flex', width: 74, justifyContent: 'flex-end', alignItems: 'baseline' }}>
                <div style={{ display: 'flex', fontFamily: SERIF, fontSize: compact ? 28 : 34 }}>{`${p.pct}`}</div>
                <div style={{ display: 'flex', fontSize: compact ? 16 : 19, marginLeft: 3 }}>%</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', fontSize: 17, opacity: 0.7, marginTop: 16 }}>{data.note}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 64px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <div style={{ display: 'flex', fontFamily: MONO, fontSize: 14, fontWeight: 500, color: C.text }}>@la.butoane</div>
          <div style={{ display: 'flex', fontFamily: MONO, fontSize: 12, color: C.faint }}>surse: cdep.ro</div>
        </div>
        {/* logo bottom-right — the IG profile picture already brands the top */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="34" height="34" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#171A1F" /><rect x="11" y="11" width="18" height="18" rx="6" fill="#2EA871" /><rect x="35" y="11" width="18" height="18" rx="6" fill="#E3A23C" /><rect x="11" y="35" width="18" height="18" rx="6" fill="#EE7B5E" /><rect x="35" y="35" width="18" height="18" rx="6" fill="#4E86D8" /></svg>
          <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 26, letterSpacing: '-0.015em', color: C.text }}>
            <span style={{ fontWeight: 400 }}>La</span><span style={{ fontWeight: 700 }}>Butoane</span>
          </div>
        </div>
      </div>
    </div>
  )
}
