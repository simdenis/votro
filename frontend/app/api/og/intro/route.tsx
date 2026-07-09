import { ImageResponse } from 'next/og'
import { IntroCard, type IntroCardData } from '@/components/cards/intro-card'
import { getCardFonts } from '@/lib/og-fonts'

// 1080×1080 launch carousel slides. Public URL: /api/og/intro?slide=1..4
export const runtime = 'edge'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vot-romania.vercel.app')
  .replace(/^https?:\/\//, '')

export async function GET(request: Request) {
  const slide = Math.min(4, Math.max(1, Number(new URL(request.url).searchParams.get('slide')) || 1))
  const data: IntroCardData = { slide, siteUrl: SITE_URL }

  const fonts = await getCardFonts()
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: 1080, height: 1080, transform: 'scale(2)', transformOrigin: 'top left' }}>
        <IntroCard data={data} />
      </div>
    ),
    { width: 2160, height: 2160, fonts },
  )
}
