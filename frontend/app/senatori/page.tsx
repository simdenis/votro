import type { Metadata } from 'next'
import { getDB } from '@/lib/supabase'
import { PoliticianList } from '@/components/politician-list'
import { getSwitcherIds } from '@/lib/switchers'
import type { PoliticianStats } from '@/lib/types'
import { SectionNav, PARLAMENTARI_SECTIONS } from '@/components/section-nav'

export const revalidate = 3600
export const metadata: Metadata = {
  title: 'Senatori',
  description: 'Lista senatorilor români cu rata de deviere față de linia de partid.',
}

// Sorting happens client-side in PoliticianList — the page stays static
// (one cached render) instead of hitting Supabase on every column click.
export default async function SenatorsPage() {
  // columns trimmed to what PoliticianList renders — the whole array is
  // serialized into the client component's props
  const [{ data }, switcherIds] = await Promise.all([
    getDB().from('senator_stats')
      .select('politician_id, name, first_name, party_abbr, party_color, total_votes, votes_for, votes_against, votes_abstention, votes_absent, votes_not_voted, chamber_votes, presence_pct, deviation_pct, gov_role')
      .eq('active', true)
      .order('name', { ascending: true }) as unknown as Promise<{ data: PoliticianStats[] | null }>,
    getSwitcherIds(),
  ])

  return (
    <div>
      <SectionNav items={PARLAMENTARI_SECTIONS} />
      <PoliticianList
        title="Senatori"
        basePath="/senatori"
        people={data ?? []}
        switcherIds={[...switcherIds]}
      />
    </div>
  )
}
