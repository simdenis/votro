import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { PoliticianList } from '@/components/politician-list'
import type { PoliticianStats } from '@/lib/types'

export const revalidate = 3600
export const metadata: Metadata = {
  title: 'Senatori',
  description: 'Lista senatorilor români cu rata de deviere față de linia de partid.',
}

export default async function SenatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>
}) {
  const sp   = await searchParams
  const sort = sp.sort ?? 'name'
  const dir  = sp.dir === 'desc'

  const { data } = await getDB()
    .from('senator_stats')
    .select('*')
    .order(
      sort === 'deviation' ? 'deviation_pct' : sort === 'votes' ? 'total_votes' : 'name',
      { ascending: !dir, nullsFirst: false }
    ) as { data: PoliticianStats[] | null }

  return (
    <PoliticianList
      title="Senatori"
      basePath="/senators"
      people={data ?? []}
      sort={sort}
      dir={dir}
    />
  )
}
