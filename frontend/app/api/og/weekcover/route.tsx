import { ImageResponse } from 'next/og'
import { getCardFonts } from '@/lib/og-fonts'
import { withEdgeCache } from '@/lib/og-edge-cache'

// 1080×1350 cover for the weekly "legi promulgate" digest carousel — slide 1,
// then a summary card per law. /api/og/weekcover?n=<count>

const C = { bg: '#FFFFFF', text: '#171A1F', for: '#2EA871', hair: '#E7E9EC', faint: '#6E7480' }
const SERIF = 'Plex Display'
const SANS = 'IBM Plex Sans'
const MONO = 'IBM Plex Mono'
const RO_MONTHS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec']

export async function GET(req: Request) {
  return withEdgeCache(req, () => render(req))
}

async function render(req: Request): Promise<Response> {
  const n = Math.max(1, Math.min(20, Number(new URL(req.url).searchParams.get('n')) || 0))
  const now = new Date()
  const from = new Date(now.getTime() - 6 * 86400_000)
  const range = `${from.getDate()} ${RO_MONTHS[from.getMonth()]} – ${now.getDate()} ${RO_MONTHS[now.getMonth()]} ${now.getFullYear()}`
  const noun = n === 1 ? 'lege promulgată' : 'legi promulgate'

  const fonts = await getCardFonts()
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: 1080, height: 1350, transform: 'scale(2)', transformOrigin: 'top left' }}>
        <div style={{ width: 1080, height: 1350, display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: SANS }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '54px 72px 0' }}>
            <div style={{ display: 'flex', fontFamily: MONO, fontSize: 18, letterSpacing: 3, textTransform: 'uppercase', color: C.faint }}>Săptămâna aceasta</div>
            <div style={{ display: 'flex', fontFamily: MONO, fontSize: 15, color: C.faint }}>{range}</div>
          </div>

          <div style={{ display: 'flex', flex: 1, alignItems: 'center', padding: '0 72px' }}>
            <div style={{ display: 'flex', width: 10, alignSelf: 'stretch', margin: '110px 0', borderRadius: 6, background: C.for, flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingLeft: 44 }}>
              <div style={{ fontFamily: SERIF, fontSize: 82, lineHeight: 1.04, color: C.text }}>Ce s-a făcut lege săptămâna asta</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 34 }}>
                <div style={{ display: 'flex', fontFamily: SERIF, fontSize: 72, color: C.for }}>{`${n}`}</div>
                <div style={{ display: 'flex', fontSize: 30, color: C.text, opacity: 0.7 }}>{noun}</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 72px 24px' }}>
            <div style={{ display: 'flex', fontSize: 24, color: C.text, opacity: 0.65 }}>Le vezi pe rând 👉</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: C.for, borderRadius: 999, padding: '11px 24px' }}>
              <div style={{ display: 'flex', fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: 1 }}>Glisează</div>
              <svg width="46" height="22" viewBox="0 0 46 22" fill="none">
                <path d="M4 4l7 7-7 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
                <path d="M18 4l7 7-7 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />
                <path d="M32 4l7 7-7 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 72px', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: C.hair }}>
            <div style={{ display: 'flex', fontFamily: MONO, fontSize: 15, fontWeight: 500, color: C.text }}>@la.butoane</div>
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
