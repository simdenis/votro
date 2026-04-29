import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { PoliticianList } from '@/components/politician-list'
import type { PoliticianStats } from '@/lib/types'

export const revalidate = 3600
export const metadata: Metadata = {
  title: 'Deputați',
  description: 'Lista deputaților români cu rata de deviere față de linia de partid.',
}

export default async function DeputiesPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>
}) {
  const sp   = await searchParams
  const sort = sp.sort ?? 'name'
  const dir  = sp.dir === 'desc'

  const { data } = await getDB()
    .from('deputy_stats')
    .select('*')
    .order(
      sort === 'deviation' ? 'deviation_pct' : sort === 'votes' ? 'total_votes' : 'name',
      { ascending: !dir, nullsFirst: false }
    ) as { data: PoliticianStats[] | null }

  return (
    <PoliticianList
      title="Deputați"
      basePath="/deputies"
      people={data ?? []}
      sort={sort}
      dir={dir}
    />
  )
}
