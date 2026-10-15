import { CardHeader, CardFooter } from './kit'
// 1080×1350 (4:5) weekly recap card — "Săptămâna în Parlament".
// Same brand language as VoteCard.

export interface WeekHighlight {
  lawCode: string
  lawTitle: string
  chamber: 'SENAT' | 'CAMERĂ'
  outcome: 'ADOPTAT' | 'RESPINS'
  votesFor: number
  votesAgainst: number
}

export interface WeekCardData {
  rangeLabel: string      // "24–30 iunie 2026"
  totalVotes: number
  adopted: number
  rejected: number
  deviations: number
  senateVotes: number
  cameraVotes: number
  closest: WeekHighlight | null
  /** Recess mode renders the whole just-ended session instead of a week. */
  kicker?: string         // default "RECAP SĂPTĂMÂNAL"
  title?: string          // default "Săptămâna în Parlament"
  highlightLabel?: string // default "Cel mai strâns vot al săptămânii"
}

const C = {
  bg: '#FFFFFF',
  text: '#171A1F',
  navy: '#171A1F',
  for: '#2EA871',
  against: '#EE7B5E',
  deviation: '#B27A24',
  hair: '#E7E9EC',
}
const SERIF = 'Plex Display'   // IBM Plex Sans 700 (see og-fonts)
const SANS = 'IBM Plex Sans'
const MONO = 'IBM Plex Mono'

export function WeekCard({ data }: { data: WeekCardData }) {
  const stats = [
    { value: data.totalVotes, label: 'voturi', color: C.text },
    { value: data.adopted, label: 'adoptate', color: C.for },
    { value: data.rejected, label: 'respinse', color: C.against },
    { value: data.deviations, label: 'devieri', color: C.deviation },
  ]
  const h = data.closest

  return (
    <div style={{ width: 1080, height: 1350, display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: SANS }}>

      <CardHeader kicker={data.kicker ?? 'RECAP SĂPTĂMÂNAL'} />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '46px 64px 0' }}>
        <div style={{ fontFamily: SERIF, fontSize: 58, lineHeight: 1.05, marginBottom: 10 }}>{data.title ?? 'Săptămâna în Parlament'}</div>
        <div style={{ display: 'flex', fontSize: 21, opacity: 0.7, marginBottom: 44 }}>{data.rangeLabel}</div>

        {/* Stat row */}
        <div style={{ display: 'flex', marginBottom: 40 }}>
          {stats.map((s, i) => (
            <div key={s.label} style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '0 22px', borderLeftWidth: i > 0 ? 1 : 0, borderLeftStyle: 'solid', borderLeftColor: C.hair }}>
              <div style={{ display: 'flex', fontFamily: SERIF, fontSize: 72, lineHeight: 1, color: s.color }}>{s.value}</div>
              <div style={{ display: 'flex', fontSize: 22, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 3, marginTop: 10 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Chamber split */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 44, fontSize: 24, opacity: 0.55 }}>
          <div style={{ display: 'flex', fontWeight: 600 }}>{`Senat ${data.senateVotes}`}</div>
          <div style={{ display: 'flex', width: 5, height: 5, borderRadius: 3, background: '#D8DBE0' }} />
          <div style={{ display: 'flex', fontWeight: 600 }}>{`Camera Deputaților ${data.cameraVotes}`}</div>
        </div>

        {/* Closest vote highlight */}
        {h && (
          <div style={{ display: 'flex', flexDirection: 'column', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: C.hair, paddingTop: 26 }}>
            <div style={{ display: 'flex', fontSize: 20, fontWeight: 600, color: C.navy, letterSpacing: 4, textTransform: 'uppercase', opacity: 0.65, marginBottom: 14 }}>
              {data.highlightLabel ?? 'Cel mai strâns vot al săptămânii'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
              <div style={{ display: 'flex', fontSize: 22, fontWeight: 500, color: C.navy, letterSpacing: 4 }}>{h.lawCode}</div>
              <div style={{ display: 'flex', fontSize: 20, opacity: 0.4, letterSpacing: 2 }}>{h.chamber}</div>
            </div>
            <div style={{ fontFamily: SERIF, fontSize: h.lawTitle.length > 120 ? 24 : 28, lineHeight: 1.2, marginBottom: 18 }}>
              {h.lawTitle.length > 220 ? h.lawTitle.slice(0, 217) + '…' : h.lawTitle}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ display: 'flex', background: h.outcome === 'ADOPTAT' ? C.for : C.against, color: '#fff', fontSize: 22, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', padding: '8px 20px', borderRadius: 3 }}>
                {h.outcome}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <div style={{ display: 'flex', fontFamily: SERIF, fontSize: 40, color: C.for }}>{h.votesFor}</div>
                <div style={{ display: 'flex', fontSize: 20, opacity: 0.3 }}>—</div>
                <div style={{ display: 'flex', fontFamily: SERIF, fontSize: 40, color: C.against }}>{h.votesAgainst}</div>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flex: 1 }} />
      </div>

      <CardFooter source={"surse: senat.ro · cdep.ro"} />
    </div>
  )
}
