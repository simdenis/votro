import { ImageResponse } from 'next/og'
import { MajorityCard } from '@/components/cards/majority-card'
import { getCardFonts } from '@/lib/og-fonts'

// 1080×1350 (4:5) edu carousel: «0 voturi împotrivă. Și tot a picat.»
// URL: /api/og/majority?slide=1..3 (deck slide 2 is /api/og/votecard for L366/2026)

export async function GET(request: Request) {
  const slide = Math.min(3, Math.max(1, Number(new URL(request.url).searchParams.get('slide')) || 1))
  const fonts = await getCardFonts()
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: 1080, height: 1350 }}>
        <MajorityCard data={{ slide }} />
      </div>
    ),
    { width: 1080, height: 1350, fonts },
  )
}
