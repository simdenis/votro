import { ImageResponse } from 'next/og'
import { getCardFonts } from '@/lib/og-fonts'

// 1200×630 site link preview — brand lockup per the social/OG mock:
// centered glyph above the wordmark, white, ink text.
export const runtime = 'edge'

export async function GET() {
  const fonts = await getCardFonts()
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%',
          background: '#FFFFFF',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          fontFamily: 'IBM Plex Sans',
        }}
      >
        <svg width="120" height="120" viewBox="0 0 64 64">
          <rect width="64" height="64" rx="15" fill="#171A1F" />
          <rect x="11" y="11" width="18" height="18" rx="6" fill="#2EA871" />
          <rect x="35" y="11" width="18" height="18" rx="6" fill="#E3A23C" />
          <rect x="11" y="35" width="18" height="18" rx="6" fill="#EE7B5E" />
          <rect x="35" y="35" width="18" height="18" rx="6" fill="#4E86D8" />
        </svg>
        <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 72, letterSpacing: '-0.015em', color: '#171A1F', marginTop: 34 }}>
          <span style={{ fontWeight: 400 }}>La</span>
          <span style={{ fontWeight: 700 }}>Butoane</span>
        </div>
        <div style={{ display: 'flex', fontSize: 26, color: '#6E7480', marginTop: 14 }}>
          Cum votează Parlamentul României
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts },
  )
}
