import { proxy, json, cleanCode, cleanDate, cleanChamber } from '@/lib/api-v1'

// GET /api/v1/votes
//   ?code=L230/2025           → every plenary vote on that law
//   ?from=YYYY-MM-DD&to=…&camera=senat|camera   → votes in a period
// Add ?format=csv (or Accept: text/csv) for CSV. Cached at the edge.
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams
  const code = cleanCode(p.get('code'))

  if (p.get('code')) {
    if (!code) return json({ error: 'Cod de lege invalid.' }, 400)
    const path = `votes?select=vote_date,chamber,outcome,for_count,against_count,abstention_count,laws!inner(code,title)`
      + `&laws.code=eq.${encodeURIComponent(code)}&order=vote_date.desc`
    return proxy(path, req, { filename: `voturi-${code.replace(/[^\w]+/g, '-')}` })
  }

  // period query — defaults to the current year if unbounded
  const from = cleanDate(p.get('from')) ?? `${new Date().getFullYear()}-01-01`
  const to = cleanDate(p.get('to')) ?? new Date().toISOString().slice(0, 10)
  const chamber = cleanChamber(p.get('camera') ?? p.get('chamber'))
  const filters = [`vote_date=gte.${from}`, `vote_date=lte.${to}`]
  if (chamber) filters.push(`chamber=eq.${chamber}`)
  filters.push('order=vote_date.desc', 'limit=2000')
  const path = `votes?select=id,vote_date,chamber,outcome,for_count,against_count,abstention_count,description`
    + `&${filters.join('&')}`
  return proxy(path, req, { filename: `voturi-${from}_${to}` })
}
