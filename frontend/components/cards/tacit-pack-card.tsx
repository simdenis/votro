import { CardHeader, CardFooter } from './kit'
// 1080×1350 (4:5) carousel for a *cluster* of pending bills sharing one tacit
// deadline (e.g. the 10 justice bills expiring 4 sept). Slide 0 = cover with
// the big count; slides 1..N = two bills per slide, the plain-language AI
// summary as the body (the official titles are jargon). Same brand language as
// TacitListCard / ShameCard.

export interface TacitPackBill {
  code: string
  chamber: 'SENAT' | 'CAMERĂ'
  summary: string
}

export interface TacitPackMeta {
  dateLabel: string      // "17 august 2026"
  deadlineLabel: string  // "vineri, 4 septembrie"
  daysLeft: number
  total: number
  slide: number          // 0 = cover
  slides: number         // total slide count (cover included)
}

const C = { bg: '#FFFFFF', text: '#171A1F', warn: '#E3A23C', hair: '#E7E9EC', faint: '#6E7480' }
const SERIF = 'Plex Display'
const SANS = 'IBM Plex Sans'
const MONO = 'IBM Plex Mono'

function Chrome({ meta, children }: { meta: TacitPackMeta; children: React.ReactNode }) {
  return (
    <div style={{ width: 1080, height: 1350, display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: SANS }}>
      <CardHeader kicker={meta.dateLabel} right={`${meta.slide + 1}/${meta.slides}`} />
      {children}
      <CardFooter source={"sursă: cdep.ro"} />
    </div>
  )
}

export function TacitPackCover({ meta, targetLine }: { meta: TacitPackMeta; targetLine: string }) {
  return (
    <Chrome meta={meta}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: '0 64px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <div style={{ fontFamily: SERIF, fontSize: 300, lineHeight: 1, color: C.warn }}>{`${meta.total}`}</div>
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 62, lineHeight: 1.08, marginTop: 8 }}>
          legi ale justiției pot trece tacit de Cameră
        </div>
        <div style={{ display: 'flex', fontSize: 24, lineHeight: 1.5, color: C.faint, marginTop: 26, maxWidth: 900 }}>
          {`Termenul constituțional expiră ${meta.deadlineLabel}, peste ${meta.daysLeft} ${meta.daysLeft === 1 ? 'zi' : 'zile'}. Fără vot până atunci, sunt considerate adoptate și merg mai departe la Senat, fără ca vreun deputat să fi apăsat vreun buton (art. 75).`}
        </div>
        <div style={{ display: 'flex', height: 1, margin: '34px 0', background: C.hair, maxWidth: 900 }} />
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 24, lineHeight: 1.7, color: C.text, maxWidth: 900 }}>
          {targetLine}
        </div>
      </div>
    </Chrome>
  )
}

export function TacitPackPair({ meta, bills }: { meta: TacitPackMeta; bills: TacitPackBill[] }) {
  return (
    <Chrome meta={meta}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '26px 64px 0' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: SERIF, fontSize: 40, color: C.warn }}>Pe cale să treacă tacit</div>
          <div style={{ display: 'flex', fontFamily: MONO, fontSize: 24, color: C.faint }}>{`termen: ${meta.deadlineLabel}`}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: 44 }}>
          {bills.map((b, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontFamily: MONO, fontSize: 24, color: C.faint, letterSpacing: 0.5, marginBottom: 12 }}>
                {`${b.code} · ${b.chamber}`}
              </div>
              <div style={{ display: 'flex', fontSize: 29, lineHeight: 1.42, fontWeight: 500 }}>
                {b.summary}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Chrome>
  )
}
