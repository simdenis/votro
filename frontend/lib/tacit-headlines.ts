import { getDB } from '@/lib/supabase'

/** {code: short headline} for tacit-term bills, written daily by
 *  scraper/tacit_headlines.py into scrape_meta (pending_bills has no headline column). */
export async function getTacitHeadlines(): Promise<Record<string, string>> {
  const { data } = await getDB().from('scrape_meta').select('value').eq('key', 'tacit_headlines').maybeSingle()
  try { return data?.value ? JSON.parse(data.value) : {} } catch { return {} }
}
