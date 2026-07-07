import { ImageResponse } from 'next/og'
import { SenatorCard, type SenatorCardData, type RecentVoteRow } from '@/components/cards/senator-card'
import { mapSenatorToCard } from '@/lib/votecard'
import { getCardFonts } from '@/lib/og-fonts'
import { isUuid } from '@/lib/utils'

export const runtime = 'edge'

const U = process.env.NEXT_PUBLIC_SUPABASE_URL!
const K = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SB = { apikey: K, Authorization: `Bearer ${K}` }

async function statsFor(id: string) {
  const sen = await (await fetch(`${U}/rest/v1/senator_stats?politician_id=eq.${id}&select=*&limit=1`, { headers: SB })).json()
  if (sen?.[0]) return { stats: sen[0], chamber: 'senate' as const }
  const dep = await (await fetch(`${U}/rest/v1/deputy_stats?politician_id=eq.${id}&select=*&limit=1`, { headers: SB })).json()
  if (dep?.[0]) return { stats: dep[0], chamber: 'deputies' as const }
  return null
}

/** Recent deviations if there are any, else the most recent votes. */
async function recentFor(id: string): Promise<{ label: string; rows: RecentVoteRow[] }> {
  const r = await fetch(
    `${U}/rest/v1/politician_votes?politician_id=eq.${id}` +
      `&select=vote_choice,party_line_deviation,votes!inner(vote_date,description,laws(code,title))` +
      `&order=votes(vote_date).desc&limit=40`,
    { headers: SB },
  )
  const rows: any[] = (await r.json()) ?? []
  if (!Array.isArray(rows) || rows.length === 0) return { label: 'Ultimele voturi', rows: [] }
  const toRow = (v: any): RecentVoteRow => ({
    lawCode: v.votes?.laws?.code ?? 'VOT DE PLEN',
    title: v.votes?.laws?.title ?? v.votes?.description ?? 'Vot de plen',
    choice: v.vote_choice,
  })
  const deviations = rows.filter(v => v.party_line_deviation)
  return deviations.length > 0
    ? { label: 'Devieri recente — a votat altfel decât partidul', rows: deviations.slice(0, 3).map(toRow) }
    : { label: 'Ultimele voturi', rows: rows.slice(0, 3).map(toRow) }
}

const SAMPLE: SenatorCardData = {
  fullName: 'Maria Popescu', partyAbbr: 'PSD', partyColor: '#e8112d', chamberLabel: 'SENATOR', year: 2026,
  totalVotes: 312, votesFor: 240, votesAgainst: 30, votesAbstain: 12, votesAbsent: 30,
  loyaltyPct: 92, deviations: 24, deviationPct: 8, noLine: false,
  recentLabel: 'Devieri recente — a votat altfel decât partidul',
  recent: [
    { lawCode: 'L 412/2026', title: 'Lege privind transparența deciziilor parlamentare', choice: 'against' },
    { lawCode: 'L 388/2026', title: 'Modificarea Codului fiscal — TVA redus pentru alimente de bază', choice: 'abstention' },
    { lawCode: 'L 341/2026', title: 'Statutul personalului didactic auxiliar', choice: 'for' },
  ],
}

export async function GET(request: Request) {
  const idParam = new URL(request.url).searchParams.get('id')
  const id = isUuid(idParam) ? idParam : null
  const found = id ? await statsFor(id) : null
  const data = found ? mapSenatorToCard(found.stats, found.chamber) : SAMPLE
  if (found && id) {
    const recent = await recentFor(id)
    data.recentLabel = recent.label
    data.recent = recent.rows
  }
  const fonts = await getCardFonts()
  // Render at 2× (2160px) — a 1080px PNG looks soft on hi-dpi screens.
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: 1080, height: 1080, transform: 'scale(2)', transformOrigin: 'top left' }}>
        <SenatorCard data={data} />
      </div>
    ),
    { width: 2160, height: 2160, fonts },
  )
}
