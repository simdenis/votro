// Shared plumbing for the public /api/v1/* endpoints.
//
// Why this exists: "Ia datele" used to hand visitors a curl line straight to
// Supabase (project ref + anon JWT, no cache, no rate limit). These endpoints
// put a server-side proxy in front — the key never reaches the client, every
// response is CDN-cacheable, and the public contract is decoupled from the
// Supabase schema/ref so we could migrate the backend without breaking anyone
// who scripted against the API. Read-only, public civic data only.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ── param sanitizers ─────────────────────────────────────────────────────────
// Values are interpolated into PostgREST filters (e.g. code=eq.<v>), so anything
// user-supplied is whitelisted to stop filter/logic-tree injection.
export function cleanCode(v: string | null): string | null {
  if (!v) return null
  const t = v.trim().toUpperCase()
  return /^[A-Z0-9][A-Z0-9/.\-]{0,24}$/.test(t) ? t : null
}
export function cleanDate(v: string | null): string | null {
  if (!v) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null
}
export function cleanChamber(v: string | null): 'deputies' | 'senate' | null {
  const t = (v ?? '').trim().toLowerCase()
  if (['deputies', 'camera', 'cameră', 'cdep'].includes(t)) return 'deputies'
  if (['senate', 'senat'].includes(t)) return 'senate'
  return null
}
/** Names feed an ilike filter — keep letters (incl. RO diacritics), spaces and
 *  hyphens, drop PostgREST-significant chars (, ( ) * . ), cap the length. */
export function cleanName(v: string | null): string | null {
  if (!v) return null
  const t = v.trim().replace(/[^\p{L}\s\-]/gu, '').slice(0, 40).trim()
  return t || null
}

// ── response helper ──────────────────────────────────────────────────────────
export function wantsCsv(req: Request): boolean {
  const f = new URL(req.url).searchParams.get('format')
  if (f) return f.toLowerCase() === 'csv'
  return (req.headers.get('accept') ?? '').includes('text/csv')
}

// CSV comes straight from PostgREST with raw (English) DB column names. Rename
// the header row to Romanian so downloaded files read in the site's language.
// Unknown columns pass through unchanged. Only the header line is touched.
const CSV_HEADERS: Record<string, string> = {
  code: 'cod', law_code: 'cod_lege', title: 'titlu', law_title: 'titlu_lege',
  law_category: 'categorie', summary: 'rezumat', summary_is_ai: 'rezumat_ai',
  interest_score: 'scor_interes', chamber: 'camera', vote_date: 'data_vot',
  outcome: 'rezultat', description: 'descriere',
  for_count: 'pentru', against_count: 'impotriva', abstention_count: 'abtineri',
  not_voted_count: 'nu_au_votat', present_count: 'prezenti',
  senate_outcome: 'rezultat_senat', camera_outcome: 'rezultat_camera',
  senate_vote_date: 'data_vot_senat', camera_vote_date: 'data_vot_camera',
  senate_vote_id: 'id_vot_senat', camera_vote_id: 'id_vot_camera',
  senate_for: 'senat_pentru', senate_against: 'senat_impotriva', senate_abstentions: 'senat_abtineri',
  camera_for: 'camera_pentru', camera_against: 'camera_impotriva', camera_abstentions: 'camera_abtineri',
  presidential_status: 'status_prezidential', presidential_date: 'data_prezidential',
  ccr_decision: 'decizie_ccr', ccr_date: 'data_ccr', em_url: 'url_expunere', status: 'status',
  first_name: 'prenume', name: 'nume', county: 'judet',
  party_abbr: 'partid', party_name: 'nume_partid', party_color: 'culoare_partid',
  vote_choice: 'vot', politician_id: 'id_parlamentar', law_id: 'id_lege', vote_id: 'id_vot',
  presence_pct: 'prezenta_pct', deviation_pct: 'deviere_pct',
  total_votes: 'total_voturi', votes_for: 'voturi_pentru', votes_against: 'voturi_impotriva',
  votes_abstention: 'voturi_abtineri', votes_absent: 'absente', votes_not_voted: 'nu_au_votat',
  deviations: 'devieri', chamber_votes: 'voturi_camera', gov_role: 'rol_guvern',
  active: 'activ', mandate_start: 'inceput_mandat', party_id: 'id_partid',
  tacit_deadline: 'termen_tacit', committee: 'comisie', term_days: 'zile_termen', source_url: 'sursa',
}

function localizeCsvHeader(csv: string): string {
  const nl = csv.indexOf('\n')
  if (nl === -1) return csv
  const header = csv.slice(0, nl).split(',').map(h => CSV_HEADERS[h.trim()] ?? h).join(',')
  return header + csv.slice(nl)
}

interface ProxyOpts { maxAge?: number; swr?: number; filename?: string }

/** Run a PostgREST query server-side and return it JSON or CSV, with CDN cache
 *  headers. `path` is the PostgREST path+query without a leading slash. */
export async function proxy(path: string, req: Request, opts: ProxyOpts = {}): Promise<Response> {
  const csv = wantsCsv(req)
  const maxAge = opts.maxAge ?? 3600
  const swr = opts.swr ?? 86400
  let upstream: Response
  try {
    upstream = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Accept: csv ? 'text/csv' : 'application/json',
      },
      next: { revalidate: maxAge },
    })
  } catch {
    return json({ error: 'Sursa de date e indisponibilă momentan.' }, 502)
  }
  let body = await upstream.text()
  if (!upstream.ok) {
    return json({ error: 'Interogare invalidă.' }, upstream.status === 400 ? 400 : 502)
  }
  if (csv) body = localizeCsvHeader(body)
  const headers: Record<string, string> = {
    'Content-Type': csv ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
    'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=${swr}`,
    'Access-Control-Allow-Origin': '*',
  }
  if (csv && opts.filename) headers['Content-Disposition'] = `attachment; filename="${opts.filename}.csv"`
  return new Response(body, { status: 200, headers })
}

// PostgREST hard-caps every response at 1000 rows (no limit= param overrides
// it), so "full dataset" endpoints must page. Distinct offset= URLs keep each
// page separately CDN/data-cacheable.
const PG_PAGE = 1000
const PG_MAX_PAGES = 30 // safety bound (30k rows) — keeps CPU/memory sane

/** Like proxy(), but follows PostgREST's 1000-row cap across pages and returns
 *  the concatenated result. `path` must not carry its own limit/offset. */
export async function proxyAll(path: string, req: Request, opts: ProxyOpts = {}): Promise<Response> {
  const csv = wantsCsv(req)
  const maxAge = opts.maxAge ?? 3600
  const swr = opts.swr ?? 86400
  const sep = path.includes('?') ? '&' : '?'
  const csvParts: string[] = []
  const jsonRows: unknown[] = []
  try {
    for (let page = 0; page < PG_MAX_PAGES; page++) {
      const url = `${SUPABASE_URL}/rest/v1/${path}${sep}limit=${PG_PAGE}&offset=${page * PG_PAGE}`
      const r = await fetch(url, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Accept: csv ? 'text/csv' : 'application/json',
        },
        next: { revalidate: maxAge },
      })
      if (!r.ok) return json({ error: 'Interogare invalidă.' }, r.status === 400 ? 400 : 502)
      let rows: number
      if (csv) {
        // Row count from Content-Range ("0-999/*"), NOT from counting lines —
        // quoted fields legally contain newlines. Strip only the header line
        // (line 1, never multi-line) from pages after the first.
        const text = (await r.text()).replace(/\r?\n$/, '')
        const m = r.headers.get('content-range')?.match(/^(\d+)-(\d+)/)
        rows = m ? Number(m[2]) - Number(m[1]) + 1 : 0
        if (rows > 0) csvParts.push(page === 0 ? text : text.slice(text.indexOf('\n') + 1))
        else if (page === 0) csvParts.push(text) // header-only empty result
      } else {
        const data = (await r.json()) as unknown[]
        rows = data.length
        jsonRows.push(...data)
      }
      if (rows < PG_PAGE) break
    }
  } catch {
    return json({ error: 'Sursa de date e indisponibilă momentan.' }, 502)
  }
  const body = csv
    ? localizeCsvHeader(csvParts.join('\n'))
    : JSON.stringify(jsonRows)
  const headers: Record<string, string> = {
    'Content-Type': csv ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
    'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=${swr}`,
    'Access-Control-Allow-Origin': '*',
  }
  if (csv && opts.filename) headers['Content-Disposition'] = `attachment; filename="${opts.filename}.csv"`
  return new Response(body, { status: 200, headers })
}

/** Server-side PostgREST fetch returning parsed JSON (for endpoints that
 *  post-process rows instead of proxying the body straight through). */
export async function sbJson<T = unknown>(path: string, revalidate = 3600): Promise<T> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    next: { revalidate },
  })
  if (!r.ok) throw new Error(`postgrest ${r.status}`)
  return r.json()
}

/** Rows → CSV with RFC-4180 quoting. Headers come from the first row's keys. */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  const cell = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\n')
}

const CHOICE_RO: Record<string, string> = {
  for: 'pentru', against: 'impotriva', abstention: 'abtinere',
  not_voted: 'nu_a_votat', absent: 'absent',
}

interface NominalRow {
  vote_choice: string
  party_line_deviation: boolean | null
  politicians: { first_name: string; name: string; parties: { abbreviation: string } | null } | null
  votes: { vote_date: string; chamber: string; laws: { code: string } | null } | null
}

/** Per-person (nominal) votes on a law, flattened to Romanian columns —
 *  shared by /api/v1/votes?nominal=1 and the /api/v1/pachet ZIP. */
export async function nominalVoteRows(code: string): Promise<Record<string, unknown>[]> {
  const path = `politician_votes?select=vote_choice,party_line_deviation,`
    + `politicians!inner(first_name,name,parties(abbreviation)),`
    + `votes!inner(vote_date,chamber,laws!inner(code))`
    + `&votes.laws.code=eq.${encodeURIComponent(code)}&order=id`
  // paged — busy laws (11 plenary votes) exceed PostgREST's 1000-row cap
  const raw: NominalRow[] = []
  for (let page = 0; page < PG_MAX_PAGES; page++) {
    const batch = await sbJson<NominalRow[]>(`${path}&limit=${PG_PAGE}&offset=${page * PG_PAGE}`)
    raw.push(...batch)
    if (batch.length < PG_PAGE) break
  }
  return raw
    .map(r => ({
      cod: r.votes?.laws?.code ?? code,
      data_vot: r.votes?.vote_date ?? '',
      camera: r.votes?.chamber === 'senate' ? 'senat' : 'camera_deputatilor',
      prenume: r.politicians?.first_name ?? '',
      nume: r.politicians?.name ?? '',
      partid: r.politicians?.parties?.abbreviation ?? '',
      vot: CHOICE_RO[r.vote_choice] ?? r.vote_choice,
      deviere_de_la_partid: r.party_line_deviation ? 'da' : 'nu',
    }))
    .sort((a, b) =>
      String(a.data_vot).localeCompare(String(b.data_vot))
      || String(a.camera).localeCompare(String(b.camera))
      || String(a.nume).localeCompare(String(b.nume), 'ro'),
    )
}

export function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  })
}
