// 1080×1350 (4:5) shame-corner card — top absentees, both chambers.
// Same brand language as VoteCard / WeekCard.

export interface ShameEntry {
  name: string
  partyAbbr: string
  partyColor: string
  chamber: 'SENAT' | 'CAMERĂ'
  absencePct: number
  /** Interval mode: absent / held, so a bare "100%" can't hide a 0-of-few. */
  absent?: number
  held?: number
}

export interface ShameCardData {
  dateLabel: string // "iulie 2026"
  /** Line under the title. Defaults to the all-time (cumulative) wording. */
  subtitle?: string
  entries: ShameEntry[]
}

const DEFAULT_SUBTITLE = 'absențe la voturile din plen, de la începutul legislaturii (dec. 2024) · Senat + Cameră'

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
  // Top-10 rankings reuse the layout with tighter rows (same 1080×1350 canvas).
  const compact = data.entries.length > 6
  const n = data.entries.length
  return (
    <div style={{ width: 1080, height: 1350, display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: SANS }}>

      <div style={{ display: 'flex', alignItems: 'center', padding: '36px 64px 22px' }}>
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 16, letterSpacing: 2.5, textTransform: 'uppercase', color: '#6E7480' }}>{data.dateLabel}</div>
      </div>
      <div style={{ display: 'flex', height: 1, margin: '0 64px', background: C.hair }} />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: '20px 64px' }}>
        <div style={{ fontFamily: SERIF, fontSize: compact ? 54 : 64, lineHeight: 1.05, color: C.against }}>{`Absențe — top ${n}`}</div>
        <div style={{ display: 'flex', fontSize: compact ? 19 : 21, opacity: 0.55, marginTop: 10, marginBottom: compact ? 20 : 40 }}>
          {data.subtitle ?? DEFAULT_SUBTITLE}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {data.entries.map((e, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: compact ? '11px 0' : '22px 0',
                // satori chokes on undefined style values — only set the key when needed
                ...(i < data.entries.length - 1 ? { borderBottom: `1px solid ${C.hair}` } : {}),
              }}
            >
              <div style={{ display: 'flex', width: compact ? 44 : 52, fontFamily: SERIF, fontSize: compact ? 26 : 38, color: C.faint }}>{`${i + 1}`}</div>
              <div style={{ display: 'flex', width: compact ? 14 : 18, height: compact ? 14 : 18, borderRadius: 4, background: e.partyColor, marginRight: compact ? 12 : 16 }} />
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ display: 'flex', fontSize: compact ? 24 : 32, fontWeight: 700 }}>{e.name}</div>
                <div style={{ display: 'flex', fontSize: compact ? 15 : 18, opacity: 0.5, marginTop: compact ? 1 : 3 }}>
                  {e.held != null && e.absent != null
                    ? `${e.partyAbbr} · ${e.chamber} · ${e.absent}/${e.held} voturi`
                    : `${e.partyAbbr} · ${e.chamber}`}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <div style={{ fontFamily: SERIF, fontSize: compact ? 38 : 58, color: C.against }}>{`${e.absencePct}`}</div>
                <div style={{ fontSize: compact ? 20 : 28, color: C.against, marginLeft: 4 }}>%</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', fontSize: 17, opacity: 0.7, marginTop: 34 }}>
          Membrii Guvernului nu sunt incluși (absența lor e structurală, nu o alegere).
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 64px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <div style={{ display: 'flex', fontFamily: MONO, fontSize: 14, fontWeight: 500, color: '#171A1F' }}>@la.butoane</div>
          <div style={{ display: 'flex', fontFamily: MONO, fontSize: 12, color: '#6E7480' }}>surse: senat.ro · cdep.ro</div>
        </div>
        {/* logo lives bottom-right — the IG profile picture already brands the top */}
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
