import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { pct } from '@/lib/utils'
import { PoliticianProfile } from '@/components/politician-profile'
import type { PoliticianStats, VoteHistoryRow } from '@/lib/types'

export const revalidate = 3600

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://votro.ro'

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

  const name     = `${data.first_name} ${data.name}`
  const desc     = `${data.name} (${data.party_abbr}) a votat în ${data.total_votes} ședințe. Rată deviere: ${data.deviation_pct != null ? `${data.deviation_pct.toFixed(1)}%` : '—'}.`
  const ogImage  = `${SITE_URL}/api/og/senator?id=${id}`

  return {
    title: `${name} — Fișă senator`,
    description: desc,
    openGraph: { title: `${name} — Fișă senator`, description: desc, images: [{ url: ogImage, width: 1200, height: 630 }] },
    twitter:    { card: 'summary_large_image', title: `${name} — Fișă senator`, description: desc, images: [ogImage] },
  }
}

export default async function SenatorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const db = getDB()

  const [r0, r1] = await Promise.all([
    db.from('senator_stats').select('*').eq('politician_id', id).maybeSingle(),
    db
      .from('politician_votes')
      .select('*, votes!inner(*, laws!inner(*))')
      .eq('politician_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const stats   = r0.data as PoliticianStats | null
  const history = r1.data as VoteHistoryRow[] | null

  if (!stats) notFound()

  return (
    <PoliticianProfile
      stats={stats}
      history={history ?? []}
      basePath="/senators"
      chamberLabel="Senat"
      siteUrl={SITE_URL}
    />
  )
}
