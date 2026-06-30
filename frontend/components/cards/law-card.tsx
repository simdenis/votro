// 1080×1080 law-journey card — same brand language as VoteCard.

export interface JourneyStep { label: string; done: boolean; final?: boolean }

export interface LawCardData {
  lawCode: string
  lawTitle: string
  category: string | null
  year: number
  statusLabel: string   // "PROMULGATĂ", "ADOPTATĂ", "ÎN DEZBATERE", "RESPINSĂ"
  statusColor: string
  dateLine: string | null // e.g. "Promulgată · 24 mai 2026"
  journey: JourneyStep[]
}

const C = {
  bg: '#fafaf8',
  text: '#0a0a14',
  navy: '#0f2464',
  for: '#1a7a42',
  hair: '#e6e5e1',
}
const SERIF = 'DM Serif Display'
const SANS = 'DM Sans'

export function LawCard({ data }: { data: LawCardData }) {
  return (
    <div style={{ width: 1080, height: 1080, display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: SANS }}>
      <div style={{ display: 'flex', height: 12 }}>
        <div style={{ flex: 1, background: '#002B7F' }} />
        <div style={{ flex: 1, background: '#FCD116' }} />
        <div style={{ flex: 1, background: '#CE1126' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '36px 64px 22px' }}>
        <div style={{ fontFamily: SERIF, fontSize: 52, color: C.navy, letterSpacing: '-1.5px', lineHeight: 1 }}>VotRO</div>
        <div style={{ display: 'flex', fontSize: 16, letterSpacing: 3, textTransform: 'uppercase', opacity: 0.38 }}>{`LEGE · ${data.year}`}</div>
      </div>
      <div style={{ display: 'flex', height: 1, margin: '0 64px', background: C.hair }} />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '40px 64px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', fontSize: 15, fontWeight: 500, color: C.navy, letterSpacing: 4, textTransform: 'uppercase' }}>{data.lawCode}</div>
          {data.category && (
            <div style={{ display: 'flex', fontSize: 13, opacity: 0.4, textTransform: 'uppercase', letterSpacing: 1.5 }}>{data.category}</div>
          )}
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 50, lineHeight: 1.12, color: C.text, marginBottom: 28, maxHeight: 300, overflow: 'hidden' }}>{data.lawTitle}</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <div style={{ display: 'flex', background: data.statusColor, color: '#fff', fontSize: 18, fontWeight: 600, letterSpacing: 4, textTransform: 'uppercase', padding: '11px 30px', borderRadius: 3 }}>
            {data.statusLabel}
          </div>
          {data.dateLine && <div style={{ display: 'flex', fontSize: 17, opacity: 0.4 }}>{data.dateLine}</div>}
        </div>

        <div style={{ display: 'flex', flex: 1 }} />

        {/* Legislative journey */}
        <div style={{ display: 'flex', height: 1, background: C.hair, marginBottom: 22 }} />
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          {data.journey.map((s, i) => {
            const color = s.final && s.done ? C.navy : s.done ? C.for : '#b9b8b2'
            return (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', flexGrow: i === data.journey.length - 1 ? 0 : 1, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: s.final ? 700 : 600, letterSpacing: 1.5, textTransform: 'uppercase', color }}>
                  {s.label}
                  {s.done ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : (
                    <div style={{ display: 'flex', width: 7, height: 7, borderRadius: 4, background: '#c9c8c2' }} />
                  )}
                </div>
                {i < data.journey.length - 1 && (
                  <div style={{ display: 'flex', flexGrow: 1, flexShrink: 1, flexBasis: 0, height: 1, background: '#d6d5cf', margin: '0 16px' }} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '18px 64px', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: C.hair, marginTop: 18 }}>
        <div style={{ display: 'flex', fontSize: 14, fontWeight: 600, color: C.navy, opacity: 0.62 }}>votro.ro</div>
        <div style={{ display: 'flex', fontSize: 12, opacity: 0.22 }}>sursă: cdep.ro / senat.ro</div>
      </div>
    </div>
  )
}
