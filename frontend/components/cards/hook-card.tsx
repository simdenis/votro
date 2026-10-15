// 1080×1350 (4:5) carousel COVER — the short catchy headline, huge, to stop
// the scroll. Slide 1 of a law carousel; the summary card (slide 2) explains.

import { categoryColor } from '@/lib/category-colors'
import { CardFooter } from './kit'

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
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 24, letterSpacing: 3, textTransform: 'uppercase', color: C.faint }}>Pe scurt</div>
        {data.category && (
          <div style={{ display: 'flex', fontSize: 24, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: 2 }}>{data.category}</div>
        )}
      </div>

      {/* the hook, vertically centered; the category colour lives on its label, not a side bar */}
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', padding: '0 72px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ fontFamily: SERIF, fontSize: hookFont(data.headline.length), lineHeight: 1.04, color: C.text }}>{data.headline}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 72px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', fontFamily: MONO, fontSize: 24, fontWeight: 500, color: C.navy, letterSpacing: 2 }}>{data.lawCode}</div>
          <div style={{ display: 'flex', background: data.statusColor, color: '#fff', fontSize: 22, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', padding: '8px 20px', borderRadius: 3 }}>
            {data.statusLabel}
          </div>
        </div>
      </div>

      <CardFooter source={null} />
    </div>
  )
}
