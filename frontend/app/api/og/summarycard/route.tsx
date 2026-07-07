import { ImageResponse } from 'next/og'
import { SummaryCard, type SummaryCardData } from '@/components/cards/summary-card'
import { mapLawToCard } from '@/lib/votecard'
import { getCardFonts } from '@/lib/og-fonts'
import { isUuid } from '@/lib/utils'
import type { LawStatus } from '@/lib/types'

// 1080×1080 "Pe scurt" card — /api/og/summarycard?id=<law_id>
// The plain-language AI summary as the hero; IG post format.

export const runtime = 'edge'

const U = process.env.NEXT_PUBLIC_SUPABASE_URL!
const K = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SB = { apikey: K, Authorization: `Bearer ${K}` }

const SAMPLE: SummaryCardData = {
  lawCode: 'L 99/2026', lawTitle: 'Propunere legislativă pentru modificarea Legii nr.360/2023 privind sistemul public de pensii',
  category: 'Social', year: 2026,
  summary: 'Acest proiect de lege vrea să se asigure că, atunci când oamenii au lucrat și au contribuit la pensie în mai multe sisteme, toate aceste perioade să fie luate în considerare pentru reducerea vârstei de pensionare.',
  statusLabel: 'RESPINSĂ', statusColor: '#7f1d1d', dateLine: 'Respinsă de Senat · 23 martie 2026',
}

export async function GET(request: Request) {
  const idParam = new URL(request.url).searchParams.get('id')
  const id = isUuid(idParam) ? idParam : null

  const law = id
    ? ((await (await fetch(`${U}/rest/v1/law_status?law_id=eq.${id}&select=*&limit=1`, { headers: SB })).json())?.[0] as LawStatus | undefined)
    : undefined

  let data = SAMPLE
  if (law?.summary) {
    const mapped = mapLawToCard(law, [], null)
    data = {
      lawCode: mapped.lawCode,
      lawTitle: law.title,
      category: law.law_category,
      year: mapped.year,
      summary: law.summary,
      statusLabel: mapped.statusLabel,
      statusColor: mapped.statusColor,
      dateLine: mapped.dateLine,
    }
  }

  const fonts = await getCardFonts()
  // Render at 2× (2160px) — a 1080px PNG looks soft on hi-dpi screens.
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: 1080, height: 1080, transform: 'scale(2)', transformOrigin: 'top left' }}>
        <SummaryCard data={data} />
      </div>
    ),
    { width: 2160, height: 2160, fonts },
  )
}
