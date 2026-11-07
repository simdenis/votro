import type { Metadata } from 'next'
import { getChamberList } from '@/lib/stats-list'
import { PoliticianList } from '@/components/politician-list'
import { getSwitcherIds } from '@/lib/switchers'
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
  const [data, switcherIds] = await Promise.all([
    getChamberList('senator_stats'),
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
