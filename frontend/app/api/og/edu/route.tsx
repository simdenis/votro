import { ImageResponse } from 'next/og'
import { EduCard, type EduCardData } from '@/components/cards/edu-card'
import { getCardFonts } from '@/lib/og-fonts'

// 1080×1350 (4:5) educational carousel slides (post #2: cum funcționează).
// URL: /api/og/edu?slide=1..6 — slide 6 shows the live pending-bills count.
export const runtime = 'edge'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function pendingCount(): Promise<number | undefined> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/pending_bills?select=id`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: 'count=exact',
      Range: '0-0',
    },
  })
  const range = r.headers.get('content-range') // e.g. "0-0/23"
  const n = Number(range?.split('/')[1])
  return Number.isFinite(n) ? n : undefined
}

export async function GET(request: Request) {
  const slide = Math.min(6, Math.max(1, Number(new URL(request.url).searchParams.get('slide')) || 1))
  const data: EduCardData = { slide }
  if (slide === 6) data.pendingCount = await pendingCount()

  const fonts = await getCardFonts()
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: 1080, height: 1350, transform: 'scale(2)', transformOrigin: 'top left' }}>
        <EduCard data={data} />
      </div>
    ),
    { width: 2160, height: 2700, fonts },
  )
}
