import { proxy, json } from '@/lib/api-v1'

// GET /api/v1/export/<dataset>[?format=csv]
// Full-dataset bulk dump — the "download the whole thing" file. Cached hard at
// the edge (24h, week-long stale-while-revalidate) and refreshed nightly by the
// cron in vercel.json, so it behaves like a static file on a CDN rather than a
// live DB query. JSON by default, CSV with ?format=csv.
const DATASETS: Record<string, { path: string; label: string }> = {
  voturi: {
    label: 'voturi',
    path: 'votes?select=id,vote_date,chamber,outcome,for_count,against_count,abstention_count,description&order=vote_date.desc',
  },
  legi: {
    label: 'legi',
    path: 'law_status?select=code,title,law_category,senate_outcome,senate_vote_date,camera_outcome,camera_vote_date,presidential_status,presidential_date&order=code.desc',
  },
  deputati: { label: 'deputati', path: 'deputy_stats?order=name.asc' },
  senatori: { label: 'senatori', path: 'senator_stats?order=name.asc' },
}

export async function GET(req: Request, { params }: { params: Promise<{ dataset: string }> }) {
  const { dataset } = await params
  const spec = DATASETS[dataset]
  if (!spec) {
    return json({ error: 'Set necunoscut.', disponibile: Object.keys(DATASETS) }, 404)
  }
  return proxy(spec.path, req, { maxAge: 86_400, swr: 604_800, filename: `labutoane-${spec.label}` })
}
