// 1080×1080 tacit-adoption card — "nobody voted this law".
// The hero visual is the parliament arc rendered entirely in absent-gray:
// a plenary vote that never happened. Amber = the brand's tacit/abstain hue.

import { computeArcDots } from './vote-card'

export interface TacitCardData {
  lawCode: string
  lawTitle: string
  chamber: 'SENAT' | 'CAMERA DEPUTAȚILOR'
  year: number
  /** chamber seat count — how many people didn't vote */
  seats: number
  /** e.g. "mai departe la Cameră · 12 mai 2026" or null */
  dateLine: string | null
}

const C = {
  bg: '#FFFFFF',
  text: '#171A1F',
  amber: '#E3A23C',
  amberDark: '#B27A24',
  hair: '#E7E9EC',
  gray500: '#6E7480',
}
const SERIF = 'Plex Display'   // IBM Plex Sans 700 (see og-fonts)
const SANS = 'IBM Plex Sans'
const MONO = 'IBM Plex Mono'

/** Shrink the title as it grows so it always fits. */
function titleFont(len: number): number {
  if (len <= 90) return 30
  if (len <= 160) return 26
  if (len <= 260) return 22
  if (len <= 380) return 19
  return 16
}

export function TacitCard({ data }: { data: TacitCardData }) {
  // every seat absent — the whole arc is gray
  const dots = computeArcDots(0, 0, 0, 0, data.seats)

  return (
    <div style={{ width: 1080, height: 1080, display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: SANS }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '32px 64px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <svg width="34" height="34" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#171A1F" /><rect x="11" y="11" width="18" height="18" rx="6" fill="#2EA871" /><rect x="35" y="11" width="18" height="18" rx="6" fill="#E3A23C" /><rect x="11" y="35" width="18" height="18" rx="6" fill="#EE7B5E" /><rect x="35" y="35" width="18" height="18" rx="6" fill="#4E86D8" /></svg>
          <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 27, letterSpacing: '-0.015em', color: '#171A1F' }}>
            <span style={{ fontWeight: 400 }}>La</span><span style={{ fontWeight: 700 }}>Butoane</span>
          </div>
        </div>
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 14, letterSpacing: 2, textTransform: 'uppercase', color: C.gray500 }}>{`ADOPTARE TACITĂ · ${data.year}`}</div>
      </div>
      <div style={{ display: 'flex', height: 1, margin: '0 64px', background: C.hair }} />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '40px 64px 0' }}>
        {/* Hook */}
        <div style={{ fontFamily: SERIF, fontSize: 66, lineHeight: 1.04, letterSpacing: '-0.5px', color: C.text }}>
          Nimeni nu a votat această lege.
        </div>
        <div style={{ display: 'flex', fontSize: 24, lineHeight: 1.45, color: C.gray500, marginTop: 20, maxWidth: 900 }}>
          {`Termenul constituțional a expirat fără vot în ${data.chamber === 'SENAT' ? 'Senat' : 'Camera Deputaților'}, așa că legea a fost considerată adoptată (art. 75).`}
        </div>

        {/* The vote that never happened — a full arc of absent-gray seats */}
        <div style={{ display: 'flex', width: '100%', height: 250, justifyContent: 'center', marginTop: 26 }}>
          <svg width={773} height={250} viewBox="0 0 952 308">
            {dots.map((d, i) => (
              <circle key={i} cx={d.x} cy={d.y} r={4.5} fill="#D8DBE0" />
            ))}
          </svg>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', fontFamily: MONO, fontSize: 14, letterSpacing: 1.5, color: C.gray500, marginTop: 2 }}>
          {`${data.seats} DE MANDATE · 0 VOTURI`}
        </div>

        {/* Badge + date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginTop: 34 }}>
          <div style={{ display: 'flex', background: C.amber, color: '#FFFFFF', fontSize: 18, fontWeight: 600, letterSpacing: 4, textTransform: 'uppercase', padding: '11px 30px', borderRadius: 3, boxShadow: `0 5px 0 ${C.amberDark}` }}>
            ADOPTATĂ TACIT
          </div>
          {data.dateLine && <div style={{ display: 'flex', fontSize: 17, color: C.text, opacity: 0.8 }}>{data.dateLine}</div>}
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 12 }} />

        {/* The law itself */}
        <div style={{ display: 'flex', height: 1, background: C.hair, marginBottom: 16 }} />
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 14, letterSpacing: 2, color: C.gray500, marginBottom: 8 }}>{data.lawCode}</div>
        <div style={{ display: 'flex', fontSize: titleFont(data.lawTitle.length), lineHeight: 1.35, color: C.text, opacity: 0.85, marginBottom: 28 }}>
          {data.lawTitle}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '18px 64px', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: C.hair }}>
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 14, fontWeight: 500, color: '#171A1F' }}>@la.butoane</div>
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 12, color: '#6E7480' }}>sursă: cdep.ro / senat.ro</div>
      </div>
    </div>
  )
}
