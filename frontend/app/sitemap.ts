import type { MetadataRoute } from 'next'
import { getDB } from '@/lib/supabase'
import { lawSlug, personSlug } from '@/lib/utils'

export const revalidate = 3600

// PostgREST hard-caps every response at 1000 rows; votes/laws are past that,
// so a single select silently drops the oldest URLs from the sitemap.
const PAGE = 1000
async function allRows<T>(build: (lo: number, hi: number) => PromiseLike<{ data: unknown }>): Promise<T[]> {
  const out: T[] = []
  for (let lo = 0; ; lo += PAGE) {
    const { data } = await build(lo, lo + PAGE - 1)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < PAGE) return out
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://labutoane.vercel.app'
  const db = getDB()

  const [votes, senators, deputies, laws, parties] = await Promise.all([
    allRows<{ id: string; vote_date: string }>((lo, hi) =>
      db.from('votes').select('id, vote_date').order('vote_date', { ascending: false }).range(lo, hi)),
    db.from('senator_stats').select('politician_id, name, first_name'),
    db.from('deputy_stats').select('politician_id, name, first_name'),
    allRows<{ id: string; code: string }>((lo, hi) =>
      db.from('laws').select('id, code').order('id').range(lo, hi)),
    db.from('party_cohesion').select('abbreviation'),
  ])

  const statics: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/voturi`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/legi`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/tacite`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${base}/parlamentarul-tau`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/senatori`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/deputati`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/partide`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/analize`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/date`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/traseisti`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/despre`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${base}/contribuie`, changeFrequency: 'monthly', priority: 0.3 },
  ]

  const voteUrls: MetadataRoute.Sitemap = votes.map(v => ({
    url: `${base}/voturi/${v.id}`,
    lastModified: v.vote_date,
    changeFrequency: 'yearly',
    priority: 0.6,
  }))

  const lawUrls: MetadataRoute.Sitemap = laws.map(l => ({
    url: `${base}/legi/${lawSlug(l.code)}`,
    changeFrequency: 'weekly',
    priority: 0.6,
  }))

  const senatorUrls: MetadataRoute.Sitemap = (senators.data ?? []).map((s: any) => ({
    url: `${base}/senatori/${personSlug(s.first_name, s.name)}`,
    changeFrequency: 'weekly',
    priority: 0.5,
  }))

  const deputyUrls: MetadataRoute.Sitemap = (deputies.data ?? []).map((d: any) => ({
    url: `${base}/deputati/${personSlug(d.first_name, d.name)}`,
    changeFrequency: 'weekly',
    priority: 0.5,
  }))

  const partyUrls: MetadataRoute.Sitemap = (parties.data ?? []).map(p => ({
    url: `${base}/partide/${p.abbreviation}`,
    changeFrequency: 'weekly',
    priority: 0.5,
  }))

  return [...statics, ...voteUrls, ...lawUrls, ...senatorUrls, ...deputyUrls, ...partyUrls]
}
