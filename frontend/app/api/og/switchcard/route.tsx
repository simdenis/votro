import { ImageResponse } from 'next/og'
import { getSwitchers } from '@/lib/switchers'
import { getCardFonts } from '@/lib/og-fonts'
import { textOnColor } from '@/lib/utils'

// 1080×1350 "traseiști" card — genuine party switchers (lib/switchers rules)
// whose latest switch happened in ?month=YYYY-MM (default: current month).
// Light render, data derived server-side from real history — nothing to spoof.

const RO_MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
                   'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie']

const C = { bg: '#FFFFFF', text: '#171A1F', accent: '#4E86D8', hair: '#E7E9EC', faint: '#6E7480' }
const SERIF = 'Plex Display'
const SANS = 'IBM Plex Sans'
const MONO = 'IBM Plex Mono'

function Pill({ abbr, color }: { abbr: string; color: string | null }) {
  const bg = color ?? '#9e9e9e'
  return (
    <div style={{
      display: 'flex', background: bg, color: textOnColor(bg), fontSize: 20, fontWeight: 700,
      padding: '4px 12px', borderRadius: 8, textTransform: 'uppercase',
    }}>{abbr}</div>
  )
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const monthParam = sp.get('month')
  const month = /^\d{4}-\d{2}$/.test(monthParam ?? '') ? monthParam! : new Date().toISOString().slice(0, 7)
  const [y, m] = month.split('-').map(Number)

  const switchers = (await getSwitchers()).filter(s => {
    const last = s.segments[s.segments.length - 1]
    return last && (last.from_date ?? '').startsWith(month)
  }).slice(0, 8)

  const fonts = await getCardFonts()
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: 1080, height: 1350, transform: 'scale(2)', transformOrigin: 'top left' }}>
        <div style={{ width: 1080, height: 1350, display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: SANS }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '36px 64px 22px' }}>
            <div style={{ display: 'flex', fontFamily: MONO, fontSize: 16, letterSpacing: 2.5, textTransform: 'uppercase', color: C.faint }}>
              {`${RO_MONTHS[m - 1]} ${y}`}
            </div>
          </div>
          <div style={{ display: 'flex', height: 1, margin: '0 64px', background: C.hair }} />

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: '20px 64px' }}>
            <div style={{ fontFamily: SERIF, fontSize: 58, lineHeight: 1.05, color: C.accent }}>Traseism — cine a schimbat partidul</div>
            <div style={{ display: 'flex', fontSize: 20, opacity: 0.55, marginTop: 10, marginBottom: 34 }}>
              {`parlamentari care au trecut la alt partid în ${RO_MONTHS[m - 1]} ${y}`}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {switchers.length === 0 && (
                <div style={{ display: 'flex', fontSize: 26, opacity: 0.6 }}>Niciun traseist luna aceasta.</div>
              )}
              {switchers.map((s, i) => {
                const from = s.segments[s.segments.length - 2]
                const to = s.segments[s.segments.length - 1]
                return (
                  <div key={s.politician_id} style={{
                    display: 'flex', alignItems: 'center', padding: '20px 0',
                    ...(i < switchers.length - 1 ? { borderBottom: `1px solid ${C.hair}` } : {}),
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <div style={{ display: 'flex', fontSize: 30, fontWeight: 700 }}>{`${s.first_name} ${s.name}`}</div>
                      <div style={{ display: 'flex', fontSize: 17, opacity: 0.5, marginTop: 2 }}>
                        {s.chamber === 'senate' ? 'SENAT' : 'CAMERĂ'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      {from && <Pill abbr={from.abbreviation} color={from.color} />}
                      {/* inline SVG arrow — "→" is not in the Plex subset */}
                      <svg width="26" height="16" viewBox="0 0 26 16"><path d="M0 8h22M16 2l7 6-7 6" stroke="#6E7480" strokeWidth="2.2" fill="none" /></svg>
                      {to && <Pill abbr={to.abbreviation} color={to.color} />}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', fontSize: 16, opacity: 0.7, marginTop: 30 }}>
              Doar schimbări confirmate de listele oficiale de membri — nu grupări de o zi din erori de vot.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 64px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
              <div style={{ display: 'flex', fontFamily: MONO, fontSize: 14, fontWeight: 500, color: '#171A1F' }}>@la.butoane</div>
              <div style={{ display: 'flex', fontFamily: MONO, fontSize: 12, color: C.faint }}>surse: senat.ro · cdep.ro</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="34" height="34" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#171A1F" /><rect x="11" y="11" width="18" height="18" rx="6" fill="#2EA871" /><rect x="35" y="11" width="18" height="18" rx="6" fill="#E3A23C" /><rect x="11" y="35" width="18" height="18" rx="6" fill="#EE7B5E" /><rect x="35" y="35" width="18" height="18" rx="6" fill="#4E86D8" /></svg>
              <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 26, letterSpacing: '-0.015em', color: '#171A1F' }}>
                <span style={{ fontWeight: 400 }}>La</span><span style={{ fontWeight: 700 }}>Butoane</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 2160, height: 2700, fonts },
  )
}
