import { ImageResponse } from 'next/og'
import { SummaryCard, type SummaryCardData } from '@/components/cards/summary-card'
import { mapLawToCard } from '@/lib/votecard'
import { getCardFonts } from '@/lib/og-fonts'
import { isUuid } from '@/lib/utils'
import type { LawStatus } from '@/lib/types'
import { withEdgeCache } from '@/lib/og-edge-cache'
import { initiatorLineFromRows } from '@/lib/ig-carousel'

// 1080×1350 (4:5) "Pe scurt" card — /api/og/summarycard?id=<law_id>
// The plain-language AI summary as the hero; IG post format.


const U = process.env.NEXT_PUBLIC_SUPABASE_URL!
const K = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SB = { apikey: K, Authorization: `Bearer ${K}` }

const SAMPLE: SummaryCardData = {
  lawCode: 'L 99/2026', lawTitle: 'Propunere legislativă pentru modificarea Legii nr.360/2023 privind sistemul public de pensii',
  category: 'Social', year: 2026,
  summary: 'Acest proiect de lege vrea să se asigure că, atunci când oamenii au lucrat și au contribuit la pensie în mai multe sisteme, toate aceste perioade să fie luate în considerare pentru reducerea vârstei de pensionare.',
  statusLabel: 'RESPINSĂ', statusColor: '#7f1d1d', dateLine: 'Respinsă de Senat · 23 martie 2026',
}

/** Compact "Inițiativă: …" line from initiator_type + the nominal list. */
async function initiatorLine(lawId: string): Promise<string | null> {
  const [lawRes, listRes] = await Promise.all([
    fetch(`${U}/rest/v1/laws?id=eq.${lawId}&select=initiator_type`, { headers: SB }),
    fetch(`${U}/rest/v1/law_initiators?law_id=eq.${lawId}&select=role_raw,party_raw`, { headers: SB }),
  ])
  const itype = ((await lawRes.json())?.[0] ?? {}).initiator_type as string | null
  return initiatorLineFromRows(itype, ((await listRes.json()) ?? []))
}

export async function GET(request: Request) {
  return withEdgeCache(request, () => renderCard(request))
}

async function renderCard(request: Request): Promise<Response> {
  const idParam = new URL(request.url).searchParams.get('id')
  const id = isUuid(idParam) ? idParam : null

  const law = id
    ? ((await (await fetch(`${U}/rest/v1/law_status?law_id=eq.${id}&select=*&limit=1`, { headers: SB })).json())?.[0] as LawStatus | undefined)
    : undefined

  let data = SAMPLE
  if (law?.summary) {
    // headline lives on laws, not the law_status view — fetch it alongside
    const [mapped, initiator, headlineRow] = await Promise.all([
      Promise.resolve(mapLawToCard(law, [], null)),
      initiatorLine(law.law_id),
      fetch(`${U}/rest/v1/laws?id=eq.${law.law_id}&select=headline`, { headers: SB })
        .then(r => r.json()).then(rows => rows?.[0]?.headline as string | null).catch(() => null),
    ])
    data = {
      lawCode: mapped.lawCode,
      lawTitle: law.title,
      category: law.law_category,
      year: mapped.year,
      summary: law.summary,
      headline: headlineRow,
      statusLabel: mapped.statusLabel,
      statusColor: mapped.statusColor,
      dateLine: mapped.dateLine,
      initiatorLine: initiator,
    }
  }

  const fonts = await getCardFonts()
  // Render at 2× (2160px) — a 1080px PNG looks soft on hi-dpi screens.
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: 1080, height: 1350, transform: 'scale(2)', transformOrigin: 'top left' }}>
        <SummaryCard data={data} />
      </div>
    ),
    { width: 2160, height: 2700, fonts },
  )
}
