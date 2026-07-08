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

// senat.ro labels unaffiliated senators "P" (fără apartenență) — the same thing
// as IND. Old rows may still carry it; fold it so it never reads as a switch.
function norm(abbr: string): string {
  return abbr === 'P' ? 'IND' : abbr
}

/** Genuine party switchers.
 *
 * The per-vote party history is noisy in two ways:
 *   1. a single sitting can group a member under the wrong party — leaving one
 *      stray history segment that disagrees with the roster (e.g. Neagu: 185
 *      votes, roster PSD, but one lone PNL row);
 *   2. a member can be grouped under a party briefly and revert (deputies shown
 *      with POT who are unaffiliated before and after).
 *
 * A claim we trust needs BOTH: ≥2 DISTINCT parties observed across the vote
 * history (sustained, not a one-sitting stray) AND the first observed party
 * differing from the CURRENT roster party (politicians.party_id, set daily from
 * the official member lists — the authoritative "now"). This yields only
 * genuine, roster-confirmed switches. */
export async function getSwitchers(): Promise<Switcher[]> {
  const db = getDB()
  const { data } = await db
    .from('politician_party_history')
    .select('politician_id, from_date, to_date, parties(abbreviation, color), politicians!inner(name, first_name, chamber, active, parties(abbreviation))')
    .order('from_date', { ascending: true })

  const rows = (data ?? []) as any[]
  const byPol = new Map<string, { s: Switcher; currentParty: string }>()
  for (const r of rows) {
    const pol = r.politicians
    let entry = byPol.get(r.politician_id)
    if (!entry) {
      entry = {
        s: {
          politician_id: r.politician_id,
          name: pol.name,
          first_name: pol.first_name,
          chamber: pol.chamber,
          active: pol.active,
          segments: [],
        },
        currentParty: norm(pol.parties?.abbreviation ?? '?'),
      }
      byPol.set(r.politician_id, entry)
    }
    const abbr = norm(r.parties?.abbreviation ?? '?')
    const segs = entry.s.segments
    // collapse consecutive same-party (after P→IND folding)
    if (segs.length && segs[segs.length - 1].abbreviation === abbr) {
      if (r.to_date === null) segs[segs.length - 1].to_date = null
      continue
    }
    segs.push({ abbreviation: abbr, color: r.parties?.color ?? null, from_date: r.from_date, to_date: r.to_date })
  }

  return [...byPol.values()]
    .filter(({ s, currentParty }) => {
      const distinct = new Set(s.segments.map(seg => seg.abbreviation)).size
      return distinct >= 2 && norm(s.segments[0].abbreviation) !== currentParty
    })
    .map(({ s }) => s)
    .sort((a, b) => `${a.first_name} ${a.name}`.localeCompare(`${b.first_name} ${b.name}`, 'ro'))
}

/** Just the ids — cheap set for list-row badges. */
export async function getSwitcherIds(): Promise<Set<string>> {
  const switchers = await getSwitchers()
  return new Set(switchers.map(s => s.politician_id))
}

export type { PartyHistoryEntry }
