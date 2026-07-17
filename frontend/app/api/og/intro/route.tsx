import { ImageResponse } from 'next/og'
import { IntroCard, type IntroCardData } from '@/components/cards/intro-card'
import { getCardFonts } from '@/lib/og-fonts'

// 1080×1350 (4:5) launch carousel slides — portrait so the profile-grid 3:4
// crop barely trims the sides. Public URL: /api/og/intro?slide=1..4

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://la-butoane.ro')
  .replace(/^https?:\/\//, '')

export async function GET(request: Request) {
  const slide = Math.min(4, Math.max(1, Number(new URL(request.url).searchParams.get('slide')) || 1))
  const data: IntroCardData = { slide, siteUrl: SITE_URL }

  const fonts = await getCardFonts()
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: 1080, height: 1350, transform: 'scale(2)', transformOrigin: 'top left' }}>
        <IntroCard data={data} />
      </div>
    ),
    { width: 2160, height: 2700, fonts },
  )
}
