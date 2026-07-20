import { ImageResponse } from 'next/og'
import { HookCard, type HookCardData } from '@/components/cards/hook-card'
import { mapLawToCard } from '@/lib/votecard'
import { getCardFonts } from '@/lib/og-fonts'
import { isUuid } from '@/lib/utils'
import type { LawStatus } from '@/lib/types'
import { withEdgeCache } from '@/lib/og-edge-cache'

// 1080×1350 carousel cover — the catchy headline (laws.headline), huge.
// /api/og/hookcard?id=<law_id>. No headline → 404 (the manifest only adds this
// slide when a headline exists, so this shouldn't happen in practice).

const U = process.env.NEXT_PUBLIC_SUPABASE_URL!
const K = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SB = { apikey: K, Authorization: `Bearer ${K}` }

export async function GET(req: Request) {
  return withEdgeCache(req, () => render(req))
}

async function render(req: Request): Promise<Response> {
  const id = isUuid(new URL(req.url).searchParams.get('id')) ? new URL(req.url).searchParams.get('id') : null
  if (!id) return new Response('bad id', { status: 400 })

  const [law, headlineRow] = await Promise.all([
    fetch(`${U}/rest/v1/law_status?law_id=eq.${id}&select=*&limit=1`, { headers: SB })
      .then(r => r.json()).then(rows => rows?.[0] as LawStatus | undefined),
    fetch(`${U}/rest/v1/laws?id=eq.${id}&select=headline`, { headers: SB })
      .then(r => r.json()).then(rows => rows?.[0]?.headline as string | null).catch(() => null),
  ])
  if (!law || !headlineRow) return new Response('no headline', { status: 404 })

  const mapped = mapLawToCard(law, [], null)
  const data: HookCardData = {
    headline: headlineRow,
    lawCode: mapped.lawCode,
    category: law.law_category,
    statusLabel: mapped.statusLabel,
    statusColor: mapped.statusColor,
  }

  const fonts = await getCardFonts()
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: 1080, height: 1350, transform: 'scale(2)', transformOrigin: 'top left' }}>
        <HookCard data={data} />
      </div>
    ),
    { width: 2160, height: 2700, fonts },
  )
}
