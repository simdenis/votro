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
  bg: '#fafaf8',
  text: '#0a0a14',
  navy: '#0f2464',
  against: '#c4362e',
  hair: '#e6e5e1',
  faint: '#9e9d97',
}
const SERIF = 'DM Serif Display'
const SANS = 'DM Sans'

export function ShameCard({ data }: { data: ShameCardData }) {
  return (
    <div style={{ width: 1080, height: 1080, display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: SANS }}>
      <div style={{ display: 'flex', height: 12 }}>
        <div style={{ flex: 1, background: '#002B7F' }} />
        <div style={{ flex: 1, background: '#FCD116' }} />
        <div style={{ flex: 1, background: '#CE1126' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '36px 64px 22px' }}>
        <div style={{ fontFamily: SERIF, fontSize: 52, color: C.navy, letterSpacing: '-1.5px', lineHeight: 1 }}>VotRO</div>
        <div style={{ display: 'flex', fontSize: 16, letterSpacing: 3, textTransform: 'uppercase', opacity: 0.55 }}>{data.dateLabel}</div>
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
        <div style={{ display: 'flex', fontSize: 15, opacity: 0.58 }}>sursa: senat.ro · cdep.ro</div>
        <div style={{ display: 'flex', fontSize: 14, fontWeight: 600, color: C.navy, opacity: 0.62 }}>votro.ro</div>
      </div>
    </div>
  )
}
