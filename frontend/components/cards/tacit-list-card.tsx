import { CardHeader, CardFooter } from './kit'
// 1080×1350 (4:5) "pe cale să treacă tacit" card — pending bills whose
// constitutional term expires in ≤N days. Same brand language as ShameCard.

export interface TacitEntry {
  code: string
  title: string
  chamber: 'SENAT' | 'CAMERĂ'
  daysLeft: number
}

export interface TacitListCardData {
  dateLabel: string
  entries: TacitEntry[]
}

const C = { bg: '#FFFFFF', text: '#171A1F', against: '#EE7B5E', warn: '#E3A23C', hair: '#E7E9EC', faint: '#6E7480' }
const SERIF = 'Plex Display'
const SANS = 'IBM Plex Sans'
const MONO = 'IBM Plex Mono'

export function TacitListCard({ data }: { data: TacitListCardData }) {
  const compact = data.entries.length > 6
  return (
    <div style={{ width: 1080, height: 1350, display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: SANS }}>
      <CardHeader kicker={data.dateLabel} />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: '20px 64px' }}>
        <div style={{ fontFamily: SERIF, fontSize: compact ? 50 : 58, lineHeight: 1.05, color: C.warn }}>Pe cale să treacă tacit</div>
        <div style={{ display: 'flex', fontSize: 24, opacity: 0.55, marginTop: 10, marginBottom: compact ? 18 : 32 }}>
          {/* "≤" is missing from the Plex subset (renders blank) — spell it out */}
          termenul constituțional expiră în cel mult 7 zile. Fără vot, sunt adoptate automat (art. 75)
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {data.entries.length === 0 && (
            <div style={{ display: 'flex', fontSize: 26, opacity: 0.6 }}>Niciun termen în următoarele 7 zile.</div>
          )}
          {data.entries.map((e, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', padding: compact ? '11px 0' : '16px 0',
              ...(i < data.entries.length - 1 ? { borderBottom: `1px solid ${C.hair}` } : {}),
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginRight: 20 }}>
                {/* kicker: code · chamber — small */}
                <div style={{ display: 'flex', fontFamily: MONO, fontSize: compact ? 20 : 22, color: C.faint, letterSpacing: 0.5, marginBottom: 3 }}>
                  {`${e.code} · ${e.chamber}`}
                </div>
                {/* the plain-language summary IS the headline */}
                <div style={{ display: 'flex', fontSize: compact ? 20 : 23, fontWeight: 700, lineHeight: 1.25 }}>
                  {e.title.length > 150 ? e.title.slice(0, 147).trimEnd() + '…' : e.title}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', flexShrink: 0 }}>
                <div style={{ fontFamily: SERIF, fontSize: compact ? 34 : 42, color: e.daysLeft <= 2 ? C.against : C.warn }}>{`${e.daysLeft}`}</div>
                <div style={{ fontSize: compact ? 20 : 22, color: C.faint, marginLeft: 6 }}>{e.daysLeft === 1 ? 'zi' : 'zile'}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', fontSize: 24, opacity: 0.7, marginTop: compact ? 20 : 30 }}>
          Adoptarea tacită nu e o formalitate: proiectul merge mai departe fără ca nimeni să fi votat.
        </div>
      </div>

      <CardFooter source={"sursă: cdep.ro"} />
    </div>
  )
}
