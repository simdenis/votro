import { proxy, json, cleanName, cleanChamber, politicianVoteRows, toCsv, wantsCsv, sbJson, CSV_BOM } from '@/lib/api-v1'
import { isUuid } from '@/lib/utils'

// GET /api/v1/parlamentari?camera=camera|senat[&nume=Ponta]
//   → voting stats per MP (deputy_stats / senator_stats views)
// GET /api/v1/parlamentari?nume=Ponta&camera=camera&voturi=1   (or ?id=<uuid>&voturi=1)
//   → that MP's full record: every law, how they voted, how the party voted
// ?format=csv for CSV.
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams
  const chamber = cleanChamber(p.get('camera') ?? p.get('chamber')) ?? 'deputies'
  const view = chamber === 'senate' ? 'senator_stats' : 'deputy_stats'
  const name = cleanName(p.get('nume') ?? p.get('name'))

  // ── full voting record for one MP ──────────────────────────────────────────
  if (p.get('voturi')) {
    const idParam = p.get('id')
    let pid = isUuid(idParam) ? idParam : null
    if (!pid) {
      if (!name) return json({ error: 'Dă „id" (UUID) sau „nume" pentru fișa de voturi.' }, 400)
      // resolve the name to a single politician in the chosen chamber
      let rows: { id: string }[]
      try {
        rows = await sbJson<{ id: string }[]>(
          `politicians?chamber=eq.${chamber}&name=ilike.*${encodeURIComponent(name)}*&select=id&order=name&limit=2`)
      } catch {
        return json({ error: 'Sursa de date e indisponibilă momentan.' }, 502)
      }
      if (!rows.length) return json({ error: `Niciun parlamentar „${name}" în ${chamber === 'senate' ? 'Senat' : 'Cameră'}.` }, 404)
      if (rows.length > 1) return json({ error: `Mai mulți parlamentari se potrivesc cu „${name}" — folosește „id".` }, 409)
      pid = rows[0].id
    }
    let record: Record<string, unknown>[]
    try {
      record = await politicianVoteRows(pid)
    } catch {
      return json({ error: 'Sursa de date e indisponibilă momentan.' }, 502)
    }
    const csv = wantsCsv(req)
    const fname = `voturi-parlamentar-${(name ?? pid).replace(/\s+/g, '-')}`
    const headers: Record<string, string> = {
      'Content-Type': csv ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
    }
    if (csv) headers['Content-Disposition'] = `attachment; filename="${fname}.csv"`
    return new Response(csv ? CSV_BOM + toCsv(record) : JSON.stringify(record), { status: 200, headers })
  }

  // ── aggregate stats (default) ───────────────────────────────────────────────
  const filters = ['order=name.asc', 'limit=1000']
  if (name) filters.unshift(`name=ilike.*${encodeURIComponent(name)}*`)
  const path = `${view}?${filters.join('&')}`
  return proxy(path, req, { filename: `parlamentari-${chamber}${name ? '-' + name.replace(/\s+/g, '-') : ''}` })
}
