import { ImageResponse } from 'next/og'
import { SenatorCard, type SenatorCardData } from '@/components/cards/senator-card'
import { mapSenatorToCard } from '@/lib/votecard'
import { getCardFonts } from '@/lib/og-fonts'

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

const SAMPLE: SenatorCardData = {
  fullName: 'Maria Popescu', partyAbbr: 'PSD', partyColor: '#e8112d', chamberLabel: 'SENATOR', year: 2026,
  totalVotes: 312, votesFor: 240, votesAgainst: 30, votesAbstain: 12, votesAbsent: 30,
  loyaltyPct: 92, deviations: 24, deviationPct: 8, noLine: false,
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id')
  const found = id ? await statsFor(id) : null
  const data = found ? mapSenatorToCard(found.stats, found.chamber) : SAMPLE
  const fonts = await getCardFonts()
  return new ImageResponse(<SenatorCard data={data} />, { width: 1080, height: 1080, fonts })
}
