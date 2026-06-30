import { ImageResponse } from 'next/og'
import { LawCard, type LawCardData } from '@/components/cards/law-card'
import { mapLawToCard } from '@/lib/votecard'
import { getCardFonts } from '@/lib/og-fonts'
import type { LawStatus } from '@/lib/types'

export const runtime = 'edge'

const U = process.env.NEXT_PUBLIC_SUPABASE_URL!
const K = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SB = { apikey: K, Authorization: `Bearer ${K}` }

const SAMPLE: LawCardData = {
  lawCode: 'L 412/2026', lawTitle: 'Lege privind transparența deciziilor parlamentare', category: 'Administrație', year: 2026,
  statusLabel: 'PROMULGATĂ', statusColor: '#0f2464', dateLine: 'Promulgată · 24 mai 2026',
  journey: [
    { label: 'Senat', done: true },
    { label: 'Cameră', done: true },
    { label: 'Lege', done: true, final: true },
  ],
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id')
  const law = id
    ? ((await (await fetch(`${U}/rest/v1/law_status?law_id=eq.${id}&select=*&limit=1`, { headers: SB })).json())?.[0] as LawStatus | undefined)
    : undefined
  const data = law ? mapLawToCard(law) : SAMPLE
  const fonts = await getCardFonts()
  return new ImageResponse(<LawCard data={data} />, { width: 1080, height: 1080, fonts })
}
