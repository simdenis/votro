// 1080×1080 shame-corner card — top absentees, both chambers.
// Same brand language as VoteCard / WeekCard.

export interface ShameEntry {
  name: string
  partyAbbr: string
  partyColor: string
  chamber: 'SENAT' | 'CAMERĂ'
  absencePct: number
}

export interface ShameCardData {
  dateLabel: string // "iulie 2026"
  entries: ShameEntry[]
}

const C = {
  bg: '#FFFFFF',
  text: '#171A1F',
  navy: '#171A1F',
  against: '#EE7B5E',
  hair: '#E7E9EC',
  faint: '#6E7480',
}
const SERIF = 'Plex Display'   // IBM Plex Sans 700 (see og-fonts)
const SANS = 'IBM Plex Sans'
const MONO = 'IBM Plex Mono'

export function ShameCard({ data }: { data: ShameCardData }) {
  return (
    <div style={{ width: 1080, height: 1080, display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: SANS }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '32px 64px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <svg width="34" height="34" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#171A1F" /><rect x="11" y="11" width="18" height="18" rx="6" fill="#2EA871" /><rect x="35" y="11" width="18" height="18" rx="6" fill="#E3A23C" /><rect x="11" y="35" width="18" height="18" rx="6" fill="#EE7B5E" /><rect x="35" y="35" width="18" height="18" rx="6" fill="#4E86D8" /></svg>
          <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 27, letterSpacing: '-0.015em', color: '#171A1F' }}>
            <span style={{ fontWeight: 400 }}>La</span><span style={{ fontWeight: 700 }}>Butoane</span>
          </div>
        </div>
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 14, letterSpacing: 2, textTransform: 'uppercase', color: '#6E7480' }}>{data.dateLabel}</div>
      </div>
      <div style={{ display: 'flex', height: 1, margin: '0 64px', background: C.hair }} />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '44px 64px 0' }}>
        <div style={{ fontFamily: SERIF, fontSize: 64, lineHeight: 1.05, color: C.against }}>Colțul rușinii</div>
        <div style={{ display: 'flex', fontSize: 21, opacity: 0.55, marginTop: 10, marginBottom: 40 }}>
          absențe la voturile din plen, de la validarea mandatului · Senat + Cameră
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {data.entries.map((e, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '22px 0',
                // satori chokes on undefined style values — only set the key when needed
                ...(i < data.entries.length - 1 ? { borderBottom: `1px solid ${C.hair}` } : {}),
              }}
            >
              <div style={{ display: 'flex', width: 52, fontFamily: SERIF, fontSize: 38, color: C.faint }}>{`${i + 1}`}</div>
              <div style={{ display: 'flex', width: 18, height: 18, borderRadius: 4, background: e.partyColor, marginRight: 16 }} />
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ display: 'flex', fontSize: 32, fontWeight: 700 }}>{e.name}</div>
                <div style={{ display: 'flex', fontSize: 18, opacity: 0.5, marginTop: 3 }}>
                  {`${e.partyAbbr} · ${e.chamber}`}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <div style={{ fontFamily: SERIF, fontSize: 58, color: C.against }}>{`${e.absencePct}`}</div>
                <div style={{ fontSize: 28, color: C.against, marginLeft: 4 }}>%</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', fontSize: 17, opacity: 0.7, marginTop: 34 }}>
          Membrii Guvernului nu sunt incluși — absența lor e structurală, nu o alegere.
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 64px 40px' }}>
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 15, color: '#6E7480' }}>sursa: senat.ro · cdep.ro</div>
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 14, fontWeight: 500, color: '#171A1F' }}>@la.butoane</div>
      </div>
    </div>
  )
}
