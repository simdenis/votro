import { proxy, json, cleanName, cleanChamber } from '@/lib/api-v1'

// GET /api/v1/parlamentari?camera=camera|senat[&nume=Ponta]
// Voting stats per MP (deputy_stats / senator_stats views). ?format=csv.
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams
  const chamber = cleanChamber(p.get('camera') ?? p.get('chamber')) ?? 'deputies'
  const view = chamber === 'senate' ? 'senator_stats' : 'deputy_stats'
  const name = cleanName(p.get('nume') ?? p.get('name'))
  const filters = ['order=name.asc', 'limit=1000']
  if (name) filters.unshift(`name=ilike.*${encodeURIComponent(name)}*`)
  const path = `${view}?${filters.join('&')}`
  return proxy(path, req, { filename: `parlamentari-${chamber}${name ? '-' + name.replace(/\s+/g, '-') : ''}` })
}
