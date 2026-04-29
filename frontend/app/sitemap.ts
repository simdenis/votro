import type { MetadataRoute } from 'next'
import { getDB } from '@/lib/supabase'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://votro.ro'
  const db = getDB()

  const [votes, senators, parties] = await Promise.all([
    db.from('votes').select('id, vote_date').order('vote_date', { ascending: false }),
    db.from('senator_stats').select('politician_id'),
    db.from('party_cohesion').select('abbreviation'),
  ])

  const statics: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/votes`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/senators`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/parties`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/despre`, changeFrequency: 'monthly', priority: 0.4 },
  ]

  const voteUrls: MetadataRoute.Sitemap = (votes.data ?? []).map(v => ({
    url: `${base}/votes/${v.id}`,
    lastModified: v.vote_date,
    changeFrequency: 'yearly',
    priority: 0.6,
  }))

  const senatorUrls: MetadataRoute.Sitemap = (senators.data ?? []).map(s => ({
    url: `${base}/senators/${s.politician_id}`,
    changeFrequency: 'weekly',
    priority: 0.5,
  }))

  const partyUrls: MetadataRoute.Sitemap = (parties.data ?? []).map(p => ({
    url: `${base}/parties/${p.abbreviation}`,
    changeFrequency: 'weekly',
    priority: 0.5,
  }))

  return [...statics, ...voteUrls, ...senatorUrls, ...partyUrls]
}
