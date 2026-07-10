import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { PoliticianProfile } from '@/components/politician-profile'
import { countNoun, hasPartyLine } from '@/lib/utils'
import type { SenatorStats, VoteHistoryRow, PartyHistoryEntry } from '@/lib/types'

export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://labutoane.vercel.app'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const { data } = await getDB()
    .from('senator_stats')
    .select('name, first_name, party_abbr, total_votes, deviation_pct')
    .eq('politician_id', id)
    .maybeSingle()
  if (!data) return { title: 'Senator' }

  const name    = `${data.first_name} ${data.name}`
  const desc    = `${data.name} (${data.party_abbr}) a votat în ${data.total_votes} ${countNoun(data.total_votes, 'ședință', 'ședințe')}.${hasPartyLine(data.party_abbr) ? ` Rată deviere: ${data.deviation_pct != null ? `${data.deviation_pct.toFixed(1)}%` : '—'}.` : ''}`
  const ogImage = `${SITE_URL}/api/og/senator?id=${id}`

  return {
    title: `${name} — Fișă senator`,
    description: desc,
    openGraph: { title: `${name} — Fișă senator`, description: desc, images: [{ url: ogImage, width: 1200, height: 630 }] },
    twitter:    { card: 'summary_large_image', title: `${name} — Fișă senator`, description: desc, images: [ogImage] },
  }
}

export default async function SenatorProfile({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const db = getDB()

  const [r0, r1, r3, r4] = await Promise.all([
    db.from('senator_stats').select('*').eq('politician_id', id).maybeSingle(),
    db
      .from('politician_votes')
      .select('*, votes!inner(*, laws(*))')
      .eq('politician_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
    // deviations fetched directly — they may be older than the 100-vote history window
    db
      .from('politician_votes')
      .select('*, votes!inner(*, laws(*))')
      .eq('politician_id', id)
      .eq('party_line_deviation', true)
      .order('created_at', { ascending: false })
      .limit(8),
    db.from('politician_party_history')
      .select('*, parties(name, abbreviation, color)')
      .eq('politician_id', id)
      .order('from_date', { ascending: true }),
  ])

  const stats = r0.data as SenatorStats | null
  if (!stats) notFound()

  return (
    <PoliticianProfile
      stats={stats}
      history={(r1.data as VoteHistoryRow[] | null) ?? []}
      deviationRows={(r3.data as VoteHistoryRow[] | null) ?? []}
      partyHistory={(r4.data as PartyHistoryEntry[] | null) ?? []}
      basePath="/senators"
      chamberLabel="Senat"
      siteUrl={SITE_URL}
    />
  )
}
