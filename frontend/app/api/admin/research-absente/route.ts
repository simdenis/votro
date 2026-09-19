// AI web research over the month's top absentees (/admin).
//
// POST { month: 'YYYY-MM' } → the same top-10 the shamecard would publish
// (guards applied), each researched on the web: is there a public reason for
// the absence (concediu medical, delegație, demisie, funcție în Guvern,
// campanie)? The point is to catch a legitimate absence BEFORE it lands on a
// public card — findings suggest a context_note, they never write one.
//
// Auth: admin cookie or X-Admin-Key, like the other /api/admin routes.
// Needs ANTHROPIC_API_KEY as a worker secret. The Claude call uses the
// server-side web_search tool, so the whole research is one API request
// (plus pause_turn resumes) — IO-bound, no CPU-cap concern.

import Anthropic from '@anthropic-ai/sdk'
import { isAdmin, keyMatches } from '@/lib/admin-auth'
import { getDB } from '@/lib/supabase'

const RO_MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
                   'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie']

type AbsRow = {
  politician_id: string; name: string; first_name: string; chamber: string
  party_abbr: string | null; gov_role: string | null; context_note: string | null
  mandate_start: string | null; held: number; absent: number
}

export type ResearchEntry = {
  name: string
  party: string
  chamber: string
  absent: number
  held: number
  verdict: 'motiv_gasit' | 'posibil_motiv' | 'nimic_gasit'
  reason: string
  suggested_note: string | null
  sources: string[]
}

function extractJson(text: string): ResearchEntry[] | null {
  // the model is asked for bare JSON, but strip fences / prose defensively
  const m = text.match(/\[[\s\S]*\]/)
  if (!m) return null
  try { return JSON.parse(m[0]) } catch { return null }
}

export async function POST(req: Request) {
  if (!(await isAdmin()) && !keyMatches(req.headers.get('x-admin-key'))) {
    return new Response('Not found', { status: 404 })
  }
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return Response.json({ error: 'ANTHROPIC_API_KEY lipsește (wrangler secret put)' }, { status: 500 })

  const { month } = await req.json().catch(() => ({}))
  if (!/^\d{4}-\d{2}$/.test(month ?? '')) {
    return Response.json({ error: 'month invalid (YYYY-MM)' }, { status: 400 })
  }

  const { data, error } = await getDB()
    .from('politician_monthly_absences')
    .select('*').eq('month', month).eq('active', true)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // same guards as the shamecard ranking — research what would actually publish
  const rows = (data ?? []) as AbsRow[]
  const heldByChamber = new Map<string, number>()
  for (const r of rows) heldByChamber.set(r.chamber, r.held)
  const top = rows
    .filter(r => !r.gov_role && !r.context_note
      && (r.mandate_start ?? '2000-01-01') <= `${month}-01`
      && (heldByChamber.get(r.chamber) ?? 0) >= 5)
    .sort((a, b) => (b.absent / b.held) - (a.absent / a.held))
    .slice(0, 10)
  if (!top.length) return Response.json({ error: 'niciun clasat pe luna asta (matview gol?)' }, { status: 404 })

  const [y, m] = month.split('-').map(Number)
  const monthRo = `${RO_MONTHS[m - 1]} ${y}`
  const list = top.map((r, i) =>
    `${i + 1}. ${r.first_name} ${r.name} (${r.party_abbr ?? 'IND'}, ${r.chamber === 'senate' ? 'Senat' : 'Camera Deputaților'}) — absent la ${r.absent} din ${r.held} voturi`
  ).join('\n')

  const prompt = [
    `Acești parlamentari români au fost cei mai absenți la voturile din plen în ${monthRo}:`, '',
    list, '',
    'Pentru FIECARE, caută pe web (presă românească, comunicate, senat.ro/cdep.ro) dacă există un motiv public al absenței în perioada respectivă: concediu medical, delegație oficială/externă, demisie sau mandat încetat, numire în Guvern sau altă funcție, campanie electorală, deces în familie, etc.',
    'Nu specula: dacă nu găsești nimic concret, spune asta.', '',
    'Răspunde DOAR cu un array JSON (fără alt text, fără ```), un obiect per persoană, în ordinea de mai sus:',
    '[{"name": "Prenume Nume", "verdict": "motiv_gasit" | "posibil_motiv" | "nimic_gasit", "reason": "o frază în română — motivul găsit sau \\"Nimic public despre absență.\\"", "suggested_note": "notă scurtă pt. context_note (ex: \\"concediu medical (sept 2026)\\") sau null", "sources": ["url1", "url2"]}]',
  ].join('\n')

  const client = new Anthropic({ apiKey })
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: prompt }]
  const call = () => client.beta.messages.create({
    model: 'claude-opus-5',
    max_tokens: 16000,
    // safety-classifier declines re-route to a fallback model server-side
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 20 }],
    messages,
  })
  let resp = await call()
  // long server-tool turns can pause; resume until a real stop
  for (let i = 0; i < 6 && resp.stop_reason === 'pause_turn'; i++) {
    messages.push({ role: 'assistant', content: resp.content })
    resp = await call()
  }
  if (resp.stop_reason === 'refusal') {
    return Response.json({ error: 'modelul a refuzat cererea' }, { status: 502 })
  }

  const text = resp.content.filter(b => b.type === 'text').map(b => b.text).join('')
  const parsed = extractJson(text)
  if (!parsed) return Response.json({ error: 'răspuns neparsabil', raw: text.slice(0, 2000) }, { status: 502 })

  // stitch the ranking numbers back on (the model only returns the research)
  const entries: ResearchEntry[] = top.map((r, i) => {
    const found = parsed[i] && typeof parsed[i] === 'object' ? parsed[i] : ({} as ResearchEntry)
    return {
      name: `${r.first_name} ${r.name}`,
      party: r.party_abbr ?? 'IND',
      chamber: r.chamber === 'senate' ? 'Senat' : 'Cameră',
      absent: r.absent, held: r.held,
      verdict: found.verdict === 'motiv_gasit' || found.verdict === 'posibil_motiv' ? found.verdict : 'nimic_gasit',
      reason: typeof found.reason === 'string' ? found.reason : 'Nimic public despre absență.',
      suggested_note: typeof found.suggested_note === 'string' ? found.suggested_note : null,
      sources: Array.isArray(found.sources) ? found.sources.filter((s: unknown) => typeof s === 'string').slice(0, 4) : [],
    }
  })
  return Response.json({ month, entries })
}
