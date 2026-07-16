import { ImageResponse } from 'next/og'
import { SummaryCard, type SummaryCardData } from '@/components/cards/summary-card'
import { mapLawToCard } from '@/lib/votecard'
import { getCardFonts } from '@/lib/og-fonts'
import { isUuid } from '@/lib/utils'
import type { LawStatus } from '@/lib/types'

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
  if (itype === 'guvern') return 'Inițiativă: Guvernul României'
  if (itype === 'cetateni') return 'Inițiativă cetățenească'
  if (itype !== 'parlamentari') return null
  const rows: { role_raw: string | null; party_raw: string | null }[] = (await listRes.json()) ?? []
  const n = rows.length
  if (!n) return null
  const roles = new Set(rows.map(r => r.role_raw).filter(Boolean))
  const noun = roles.size === 1
    ? (roles.has('senator') ? (n === 1 ? 'senator' : 'senatori') : (n === 1 ? 'deputat' : 'deputați'))
    : (n === 1 ? 'parlamentar' : 'parlamentari')
  const de = n >= 20 ? 'de ' : ''
  // stored party strings can be raw fisa text — minority orgs fold into MIN
  const norm = (p: string) => /minorit/i.test(p.normalize('NFKD')) ? 'MIN' : p.split(/\s+A devenit|\(/)[0].trim()
  const counts: Record<string, number> = {}
  for (const r of rows) if (r.party_raw) { const p = norm(r.party_raw); if (p) counts[p] = (counts[p] ?? 0) + 1 }
  const majority = Object.entries(counts).find(([, c]) => c / n >= 0.8)?.[0]
  const parties = Object.keys(counts)
  if (majority) return `Inițiativă: ${n} ${de}${noun} ${majority}`
  if (parties.length > 3) return `Inițiativă: ${n} ${de}${noun} din ${parties.length}${parties.length >= 20 ? ' de' : ''} partide`
  return `Inițiativă: ${n} ${de}${noun}${parties.length ? ` (${parties.join(', ')})` : ''}`
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
      initiatorLine: await initiatorLine(law.law_id),
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
