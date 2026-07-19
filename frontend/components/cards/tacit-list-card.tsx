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
      <div style={{ display: 'flex', alignItems: 'center', padding: '36px 64px 22px' }}>
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 16, letterSpacing: 2.5, textTransform: 'uppercase', color: C.faint }}>{data.dateLabel}</div>
      </div>
      <div style={{ display: 'flex', height: 1, margin: '0 64px', background: C.hair }} />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: '20px 64px' }}>
        <div style={{ fontFamily: SERIF, fontSize: compact ? 50 : 58, lineHeight: 1.05, color: C.warn }}>Pe cale să treacă tacit</div>
        <div style={{ display: 'flex', fontSize: 19, opacity: 0.55, marginTop: 10, marginBottom: compact ? 18 : 32 }}>
          {/* "≤" is missing from the Plex subset (renders blank) — spell it out */}
          termenul constituțional expiră în cel mult 7 zile — fără vot, sunt adoptate automat (art. 75)
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
                <div style={{ display: 'flex', fontSize: compact ? 21 : 24, fontWeight: 700 }}>
                  {`${e.code} · ${e.chamber}`}
                </div>
                <div style={{ display: 'flex', fontSize: compact ? 16 : 18, opacity: 0.6, marginTop: 2, lineHeight: 1.3 }}>
                  {e.title.length > 92 ? e.title.slice(0, 89).trimEnd() + '…' : e.title}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', flexShrink: 0 }}>
                <div style={{ fontFamily: SERIF, fontSize: compact ? 34 : 42, color: e.daysLeft <= 2 ? C.against : C.warn }}>{`${e.daysLeft}`}</div>
                <div style={{ fontSize: compact ? 16 : 18, color: C.faint, marginLeft: 6 }}>{e.daysLeft === 1 ? 'zi' : 'zile'}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', fontSize: 16, opacity: 0.7, marginTop: compact ? 20 : 30 }}>
          Adoptarea tacită nu e o formalitate: proiectul merge mai departe fără ca nimeni să fi votat.
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 64px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <div style={{ display: 'flex', fontFamily: MONO, fontSize: 14, fontWeight: 500, color: '#171A1F' }}>@la.butoane</div>
          <div style={{ display: 'flex', fontFamily: MONO, fontSize: 12, color: C.faint }}>sursa: cdep.ro</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="34" height="34" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#171A1F" /><rect x="11" y="11" width="18" height="18" rx="6" fill="#2EA871" /><rect x="35" y="11" width="18" height="18" rx="6" fill="#E3A23C" /><rect x="11" y="35" width="18" height="18" rx="6" fill="#EE7B5E" /><rect x="35" y="35" width="18" height="18" rx="6" fill="#4E86D8" /></svg>
          <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 26, letterSpacing: '-0.015em', color: '#171A1F' }}>
            <span style={{ fontWeight: 400 }}>La</span><span style={{ fontWeight: 700 }}>Butoane</span>
          </div>
        </div>
      </div>
    </div>
  )
}
