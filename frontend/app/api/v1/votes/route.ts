import { proxy, proxyAll, json, cleanCode, cleanDate, cleanChamber, nominalVoteRows, toCsv, wantsCsv, truthyParam, rejectUnknownParams, CSV_BOM } from '@/lib/api-v1'
import { todayRo } from '@/lib/utils'

// GET /api/v1/votes
//   ?code=L230/2025           → every plenary vote on that law
//   ?code=L230/2025&nominal=1 → how each parliamentarian voted (vot nominal)
//   ?from=YYYY-MM-DD&to=…&camera=senat|camera   → votes in a period
// Add ?format=csv (or Accept: text/csv) for CSV. Cached at the edge.
export async function GET(req: Request) {
  const bad = rejectUnknownParams(req, ['code', 'nominal', 'from', 'to', 'camera', 'chamber', 'format'])
  if (bad) return bad
  const p = new URL(req.url).searchParams
  const code = cleanCode(p.get('code'))

  if (p.get('code')) {
    if (!code) return json({ error: 'Cod de lege invalid.' }, 400)
    const slug = code.replace(/[^\w]+/g, '-')

    if (truthyParam(p.get('nominal'))) {
      let rows: Record<string, unknown>[]
      try {
        rows = await nominalVoteRows(code)
      } catch {
        return json({ error: 'Sursa de date e indisponibilă momentan.' }, 502)
      }
      const csv = wantsCsv(req)
      const headers: Record<string, string> = {
        'Content-Type': csv ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        'Access-Control-Allow-Origin': '*',
      }
      if (csv) headers['Content-Disposition'] = `attachment; filename="vot-nominal-${slug}.csv"`
      return new Response(csv ? CSV_BOM + toCsv(rows) : JSON.stringify(rows), { status: 200, headers })
    }

    const path = `votes?select=vote_date,chamber,outcome,for_count,against_count,abstention_count,laws!inner(code,title)`
      + `&laws.code=eq.${encodeURIComponent(code)}&order=vote_date.desc`
    return proxy(path, req, { filename: `voturi-${slug}` })
  }

  // period query — defaults to the current year (RO time) if unbounded.
  // A *present but unparseable* bound is an error, not a reason to silently
  // widen the window: ?from=abc used to return the whole year with a 200.
  for (const k of ['from', 'to'] as const) {
    const raw = p.get(k)
    if (raw !== null && raw !== '' && !cleanDate(raw)) {
      return json({ error: `Parametrul „${k}" trebuie să fie o dată calendaristică validă în format YYYY-MM-DD.` }, 400)
    }
  }
  const today = todayRo()
  const from = cleanDate(p.get('from')) ?? `${today.slice(0, 4)}-01-01`
  const to = cleanDate(p.get('to')) ?? today
  if (from > to) {
    return json({ error: 'Intervalul e inversat: „from" trebuie să fie ≤ „to".' }, 400)
  }
  // Bound the window so a single request can't force an arbitrarily large dump —
  // the /api/v1/export endpoint exists for the full dataset.
  const MAX_WINDOW_DAYS = 366
  const spanDays = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000
  if (spanDays > MAX_WINDOW_DAYS) {
    return json({ error: `Intervalul e prea mare (max ${MAX_WINDOW_DAYS} de zile). Pentru tot setul, folosește /api/v1/export/voturi.` }, 400)
  }
  const chamber = cleanChamber(p.get('camera') ?? p.get('chamber'))
  const filters = [`vote_date=gte.${from}`, `vote_date=lte.${to}`]
  if (chamber) filters.push(`chamber=eq.${chamber}`)
  filters.push('order=vote_date.desc')
  const path = `votes?select=id,vote_date,chamber,outcome,for_count,against_count,abstention_count,description`
    + `&${filters.join('&')}`
  // proxyAll: a year of votes is >1000 rows — PostgREST caps single responses
  // at 1000 (the old limit=2000 was silently ignored).
  return proxyAll(path, req, { filename: `voturi-${from}_${to}` })
}
