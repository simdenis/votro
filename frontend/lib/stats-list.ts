import { getDB } from '@/lib/supabase'
import type { PoliticianStats } from '@/lib/types'

const COLS = 'politician_id, name, first_name, party_abbr, party_color, total_votes, votes_for, votes_against, votes_abstention, votes_absent, votes_not_voted, chamber_votes, presence_pct, deviation_pct, gov_role'

/** Active members of one chamber for /senatori and /deputati. The stats views
 *  take 1–4 s and sometimes hit the anon statement timeout; an empty result used
 *  to be cached for an hour («0 deputați», 6 Nov 2026). One retry, then throw:
 *  a failed ISR revalidation keeps serving the last good page. */
export async function getChamberList(view: 'senator_stats' | 'deputy_stats'): Promise<PoliticianStats[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await getDB().from(view).select(COLS).eq('active', true).order('name', { ascending: true })
    if (!error && data?.length) return data as unknown as PoliticianStats[]
  }
  throw new Error(`${view}: no rows after retry`)
}
