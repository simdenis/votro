import { CHAMBER_SEATS } from './utils'

const U = process.env.NEXT_PUBLIC_SUPABASE_URL!
const K = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/** Occupied seats per chamber = active mandates in the DB. The roster scraper
 *  keeps these in sync with cdep/senat daily (ended mandates deactivate,
 *  never-voted ministers are inserted), so the count tracks vacancies the
 *  nominal totals miss. Falls back to CHAMBER_SEATS on failure. Plain fetch —
 *  works in both server components and edge routes. */
export async function activeSeats(chamber: 'senate' | 'deputies'): Promise<number> {
  try {
    const r = await fetch(
      `${U}/rest/v1/politicians?chamber=eq.${chamber}&active=is.true&select=id&limit=1`,
      {
        headers: { apikey: K, Authorization: `Bearer ${K}`, Prefer: 'count=exact' },
        next: { revalidate: 3600 },
      },
    )
    const total = Number(r.headers.get('content-range')?.split('/')[1])
    // sanity floor — an empty/broken count must not zero out absentees
    if (Number.isFinite(total) && total > 100) return total
  } catch { /* fall through */ }
  return CHAMBER_SEATS[chamber]
}

/** Occupied seats per party for a chamber (active mandates grouped by party
 *  abbreviation). Turns a vote's recorded absents into true absents: senat.ro
 *  breakdowns list only voters, so party seats − party votes = the absentees
 *  the source omits. Returns null on a broken/short roster so callers keep the
 *  recorded numbers. */
export async function activeSeatsByParty(chamber: 'senate' | 'deputies'): Promise<Record<string, number> | null> {
  try {
    const r = await fetch(
      `${U}/rest/v1/politicians?chamber=eq.${chamber}&active=is.true&select=parties(abbreviation)`,
      { headers: { apikey: K, Authorization: `Bearer ${K}` }, next: { revalidate: 3600 } },
    )
    const rows: { parties: { abbreviation: string } | null }[] = (await r.json()) ?? []
    if (!Array.isArray(rows) || rows.length <= 100) return null
    const out: Record<string, number> = {}
    for (const row of rows) {
      if (!row.parties) continue
      out[row.parties.abbreviation] = (out[row.parties.abbreviation] ?? 0) + 1
    }
    return out
  } catch {
    return null
  }
}
