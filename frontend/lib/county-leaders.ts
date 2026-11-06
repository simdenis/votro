import { getDB } from '@/lib/supabase'

export type CountyLeader = { parties: { abbr: string; color: string }[]; seats: number; total: number }

/** Per county: the party with the most sitting MPs (senators + deputies) elected
 *  there, by current party. A tie lists every tied party, so the map never picks one.
 *  ~460 rows, under PostgREST's 1000-row cap. */
export async function getCountyLeaders(): Promise<Record<string, CountyLeader>> {
  const { data } = await getDB()
    .from('politicians')
    .select('county, parties(abbreviation, color)')
    .eq('active', true)
    .not('county', 'is', null)
  const counts: Record<string, Record<string, { n: number; color: string }>> = {}
  for (const r of (data ?? []) as unknown as { county: string; parties: { abbreviation: string; color: string | null } | null }[]) {
    const p = r.parties
    if (!p) continue
    const c = (counts[r.county] ??= {})
    const e = (c[p.abbreviation] ??= { n: 0, color: p.color ?? '#9e9e9e' })
    e.n++
  }
  const out: Record<string, CountyLeader> = {}
  for (const [county, byParty] of Object.entries(counts)) {
    const ranked = Object.entries(byParty).sort((a, b) => b[1].n - a[1].n)
    const total = ranked.reduce((s, [, v]) => s + v.n, 0)
    const seats = ranked[0]?.[1].n ?? 0
    if (!seats) continue
    const parties = ranked.filter(([, v]) => v.n === seats).map(([abbr, v]) => ({ abbr, color: v.color }))
    out[county] = { parties, seats, total }
  }
  return out
}
