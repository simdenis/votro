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
