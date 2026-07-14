import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { countNoun, hasPartyLine, isUuid, personSlug } from '@/lib/utils'
import { PoliticianProfile } from '@/components/politician-profile'
import type { PoliticianStats, VoteHistoryRow, PartyHistoryEntry } from '@/lib/types'

export const revalidate = 3600

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://labutoane.vercel.app'

// A deputy is addressed by name slug (/deputati/ionel-carp); UUIDs still
// resolve (old links). Returns the politician_id or null.
async function resolveId(db: ReturnType<typeof getDB>, param: string): Promise<string | null> {
  if (isUuid(param)) return param
  const { data } = await db.from('politicians').select('id').eq('slug', param).eq('chamber', 'deputies').maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const db = getDB()
  const pid = await resolveId(db, id)
  if (!pid) return { title: 'Deputat' }
  const { data } = await db
    .from('deputy_stats')
    .select('name, first_name, party_abbr, total_votes, deviation_pct')
    .eq('politician_id', pid)
    .maybeSingle()
  if (!data) return { title: 'Deputat' }

  const name    = `${data.first_name} ${data.name}`
  const desc    = `${data.name} (${data.party_abbr}) a votat în ${data.total_votes} ${countNoun(data.total_votes, 'ședință', 'ședințe')}.${hasPartyLine(data.party_abbr) ? ` Rată deviere: ${data.deviation_pct != null ? `${data.deviation_pct.toFixed(1)}%` : '—'}.` : ''}`
  const ogImage = `${SITE_URL}/api/og/senator?id=${pid}`

  return {
    title: `${name} — Fișă deputat`,
    description: desc,
    alternates: { canonical: `/deputati/${personSlug(data.first_name, data.name)}` },
    openGraph: { title: `${name} — Fișă deputat`, description: desc, images: [{ url: ogImage, width: 1200, height: 630 }] },
    twitter:    { card: 'summary_large_image', title: `${name} — Fișă deputat`, description: desc, images: [ogImage] },
  }
}

export default async function DeputyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = getDB()
  const pid = await resolveId(db, id)
  if (!pid) notFound()

  const [r0, r1, r3, r4] = await Promise.all([
    db.from('deputy_stats').select('*').eq('politician_id', pid).maybeSingle(),
    db
      .from('politician_votes')
      .select('*, votes!inner(*, laws(*))')
      .eq('politician_id', pid)
      .order('votes(vote_date)', { ascending: false })
      .limit(100),
    // deviations fetched directly — they may be older than the 100-vote history window
    db
      .from('politician_votes')
      .select('*, votes!inner(*, laws(*))')
      .eq('politician_id', pid)
      .eq('party_line_deviation', true)
      .order('votes(vote_date)', { ascending: false })
      .limit(8),
    db.from('politician_party_history')
      .select('*, parties(name, abbreviation, color)')
      .eq('politician_id', pid)
      .order('from_date', { ascending: true }),
  ])

  const stats   = r0.data as PoliticianStats | null
  const history = r1.data as VoteHistoryRow[] | null

  if (!stats) notFound()

  return (
    <PoliticianProfile
      stats={stats}
      history={history ?? []}
      deviationRows={(r3.data as VoteHistoryRow[] | null) ?? []}
      partyHistory={(r4.data as PartyHistoryEntry[] | null) ?? []}
      basePath="/deputati"
      chamberLabel="Camera Deputaților"
      siteUrl={SITE_URL}
    />
  )
}
