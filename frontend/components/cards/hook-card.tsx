// 1080×1350 (4:5) carousel COVER — the short catchy headline, huge, to stop
// the scroll. Slide 1 of a law carousel; the summary card (slide 2) explains.

import { categoryColor } from '@/lib/category-colors'

export interface HookCardData {
  headline: string
  lawCode: string
  category: string | null
  statusLabel: string
  statusColor: string
}

const C = { bg: '#FFFFFF', text: '#171A1F', navy: '#171A1F', hair: '#E7E9EC', faint: '#6E7480' }
const SERIF = 'Plex Display'
const SANS = 'IBM Plex Sans'
const MONO = 'IBM Plex Mono'

/** Giant cover headline, sized to fit 1080×~700 of vertical space. */
function hookFont(len: number): number {
  if (len <= 24) return 118
  if (len <= 40) return 96
  if (len <= 60) return 78
  if (len <= 84) return 64
  if (len <= 110) return 54
  return 46
}

export function HookCard({ data }: { data: HookCardData }) {
  const accent = categoryColor(data.category) ?? C.navy
  return (
    <div style={{ width: 1080, height: 1350, display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: SANS }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '54px 72px 0' }}>
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 18, letterSpacing: 3, textTransform: 'uppercase', color: C.faint }}>Pe scurt</div>
        {data.category && (
          <div style={{ display: 'flex', fontSize: 16, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: 2 }}>{data.category}</div>
        )}
      </div>

      {/* the hook — vertically centered, with a thick category accent bar */}
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', padding: '0 72px' }}>
        <div style={{ display: 'flex', width: 10, alignSelf: 'stretch', margin: '90px 0', borderRadius: 6, background: accent, flexShrink: 0 }} />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingLeft: 44 }}>
          <div style={{ fontFamily: SERIF, fontSize: hookFont(data.headline.length), lineHeight: 1.04, color: C.text }}>{data.headline}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '0 72px 20px' }}>
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 17, fontWeight: 500, color: C.navy, letterSpacing: 2 }}>{data.lawCode}</div>
        <div style={{ display: 'flex', background: data.statusColor, color: '#fff', fontSize: 15, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', padding: '8px 20px', borderRadius: 3 }}>
          {data.statusLabel}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 72px', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: C.hair }}>
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 15, fontWeight: 500, color: C.navy }}>@la.butoane</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="34" height="34" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#171A1F" /><rect x="11" y="11" width="18" height="18" rx="6" fill="#2EA871" /><rect x="35" y="11" width="18" height="18" rx="6" fill="#E3A23C" /><rect x="11" y="35" width="18" height="18" rx="6" fill="#EE7B5E" /><rect x="35" y="35" width="18" height="18" rx="6" fill="#4E86D8" /></svg>
          <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 26, letterSpacing: '-0.015em', color: C.navy }}>
            <span style={{ fontWeight: 400 }}>La</span><span style={{ fontWeight: 700 }}>Butoane</span>
          </div>
        </div>
      </div>
    </div>
  )
}
