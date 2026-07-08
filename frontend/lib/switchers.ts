import { getDB } from '@/lib/supabase'
import type { PartyHistoryEntry } from '@/lib/types'

export interface Switcher {
  politician_id: string
  name: string
  first_name: string
  chamber: 'senate' | 'deputies'
  active: boolean
  segments: {
    abbreviation: string
    color: string | null
    from_date: string
    to_date: string | null
  }[]
}

/** Party-switchers = members whose history spans ≥2 distinct parties.
    Single source of truth for the list badges and the /traseisti page.
    (politician_party_history rows are already collapsed by
    rebuild_party_history.py, so consecutive same-party runs never appear.) */
export async function getSwitchers(): Promise<Switcher[]> {
  const db = getDB()
  const { data } = await db
    .from('politician_party_history')
    .select('politician_id, from_date, to_date, parties(abbreviation, color), politicians!inner(name, first_name, chamber, active)')
    .order('from_date', { ascending: true })

  const rows = (data ?? []) as any[]
  const byPol = new Map<string, Switcher>()
  for (const r of rows) {
    const pol = r.politicians
    let s = byPol.get(r.politician_id)
    if (!s) {
      s = {
        politician_id: r.politician_id,
        name: pol.name,
        first_name: pol.first_name,
        chamber: pol.chamber,
        active: pol.active,
        segments: [],
      }
      byPol.set(r.politician_id, s)
    }
    s.segments.push({
      abbreviation: r.parties?.abbreviation ?? '?',
      color: r.parties?.color ?? null,
      from_date: r.from_date,
      to_date: r.to_date,
    })
  }

  return [...byPol.values()]
    .filter(s => new Set(s.segments.map(seg => seg.abbreviation)).size >= 2)
    .sort((a, b) => `${a.first_name} ${a.name}`.localeCompare(`${b.first_name} ${b.name}`, 'ro'))
}

/** Just the ids — cheap set for list-row badges. */
export async function getSwitcherIds(): Promise<Set<string>> {
  const switchers = await getSwitchers()
  return new Set(switchers.map(s => s.politician_id))
}

export type { PartyHistoryEntry }
