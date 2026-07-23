import { cache } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { countNoun, hasPartyLine, isUuid, personSlug } from '@/lib/utils'
import { PoliticianProfile } from '@/components/politician-profile'
import type { SenatorStats, VoteHistoryRow, PartyHistoryEntry } from '@/lib/types'

export const revalidate = 600 // ISR — CDN-cache per senator for 10 min
export const dynamicParams = true
export async function generateStaticParams() { return [] }

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://la-butoane.ro'

// A senator is addressed by name slug (/senatori/victor-viorel-ponta); UUIDs
// still resolve (old links). Returns the politician_id or null.
// cache(): generateMetadata and the page share one resolve + one stats query.
const resolveId = cache(async (param: string): Promise<string | null> => {
  if (isUuid(param)) return param
  const { data } = await getDB().from('politicians').select('id').eq('slug', param).eq('chamber', 'senate').maybeSingle()
  return (data as { id: string } | null)?.id ?? null
})
const getStats = cache(async (pid: string): Promise<SenatorStats | null> => {
  const { data } = await getDB().from('senator_stats').select('*').eq('politician_id', pid).maybeSingle()
  return data as SenatorStats | null
})

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const pid = await resolveId(id)
  const data = pid ? await getStats(pid) : null
  if (!data) return { title: 'Senator' }

  const name    = `${data.first_name} ${data.name}`
  const desc    = `${data.name} (${data.party_abbr}) a votat în ${data.total_votes} ${countNoun(data.total_votes, 'ședință', 'ședințe')}.${hasPartyLine(data.party_abbr) ? ` Rată deviere: ${data.deviation_pct != null ? `${data.deviation_pct.toFixed(1)}%` : '—'}.` : ''}`
  const ogImage = `${SITE_URL}/api/og/senator?id=${pid}`

  return {
    title: `${name} — Fișă senator`,
    description: desc,
    alternates: { canonical: `/senatori/${personSlug(data.first_name, data.name)}` },
    openGraph: { title: `${name} — Fișă senator`, description: desc, images: [{ url: ogImage, width: 1200, height: 630 }] },
    twitter:    { card: 'summary_large_image', title: `${name} — Fișă senator`, description: desc, images: [ogImage] },
  }
}

export default async function SenatorProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDB()
  const pid = await resolveId(id)
  if (!pid) notFound()

  // history columns trimmed to what VoteHistory/DeviationList render —
  // votes!inner(*, laws(*)) dragged every law summary into the client props
  const HISTORY_COLS = 'id, vote_id, vote_choice, party_line_deviation, votes!inner(vote_date, vote_type, outcome, description, laws(code, title, law_category))'
  const [stats, r1, r3, r4] = await Promise.all([
    getStats(pid),
    db
      .from('politician_votes')
      .select(HISTORY_COLS)
      .eq('politician_id', pid)
      .order('votes(vote_date)', { ascending: false })
      .limit(100),
    // deviations fetched directly — they may be older than the 100-vote history window
    db
      .from('politician_votes')
      .select(HISTORY_COLS)
      .eq('politician_id', pid)
      .eq('party_line_deviation', true)
      .order('votes(vote_date)', { ascending: false })
      .limit(50),
    db.from('politician_party_history')
      .select('*, parties(name, abbreviation, color)')
      .eq('politician_id', pid)
      .order('from_date', { ascending: true }),
  ])

  if (!stats) notFound()

  return (
    <PoliticianProfile
      stats={stats}
      history={(r1.data as unknown as VoteHistoryRow[] | null) ?? []}
      deviationRows={(r3.data as unknown as VoteHistoryRow[] | null) ?? []}
      partyHistory={(r4.data as PartyHistoryEntry[] | null) ?? []}
      basePath="/senatori"
      chamberLabel="Senat"
      siteUrl={SITE_URL}
    />
  )
}
