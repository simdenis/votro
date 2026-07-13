import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { PoliticianList } from '@/components/politician-list'
import { getSwitcherIds } from '@/lib/switchers'
import type { PoliticianStats } from '@/lib/types'
import { SectionNav, PARLAMENTARI_SECTIONS } from '@/components/section-nav'

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

  let query = getDB().from('deputy_stats').select('*').eq('active', true)
  if (sort === 'party') {
    query = query.order('party_abbr', { ascending: !dir, nullsFirst: false }).order('name', { ascending: true })
  } else if (sort === 'absence') {
    // Government members (gov_role) never vote — their "absence" is
    // structural, so they sort last. Then: absence = 100 − presence,
    // ascending absence is descending presence.
    query = query
      .order('gov_role', { ascending: true, nullsFirst: true })
      .order('presence_pct', { ascending: dir, nullsFirst: false })
  } else {
    query = query.order(
      sort === 'deviation' ? 'deviation_pct'
      : sort === 'votes'   ? 'total_votes'
      : 'name',
      { ascending: !dir, nullsFirst: false }
    )
  }
  const [{ data }, switcherIds] = await Promise.all([
    query as unknown as Promise<{ data: PoliticianStats[] | null }>,
    getSwitcherIds(),
  ])

  return (
    <div>
      <SectionNav items={PARLAMENTARI_SECTIONS} />
      <PoliticianList
      title="Deputați"
      basePath="/deputati"
      people={data ?? []}
      sort={sort}
      dir={dir}
      switcherIds={switcherIds}
      />
    </div>
  )
}
