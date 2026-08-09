import { ImageResponse } from 'next/og'
import { SessionOpenCard, type PartyRow, type SessionOpenCardData } from '@/components/cards/session-open-card'
import { getCardFonts } from '@/lib/og-fonts'
import { withEdgeCache } from '@/lib/og-edge-cache'

// 1080×1350 (4:5) Instagram card — who did not vote at a session opening.
//   /api/og/sessioncard?v=<uuid>,<uuid>&label=…&headline=…
//
// Everything is recomputed from the vote rows at render time; nothing about the
// count is hardcoded, so re-rendering after a party-label fix or a re-scrape
// yields the corrected card. Absence is derived, not scraped: cdep publishes who
// voted, so an absentee is a sitting deputy who appears in none of the given
// votes (union of the present sets — present at either one counts as present).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SB = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }

// The two opening roll-calls of the July 2026 extraordinary session.
const DEFAULT_VOTES = [
  'fbde4c3e-4aa0-41ba-9167-19bf24ff1aa2', // Programul de lucru
  'c7100395-2294-4d2f-aba2-6c68fc9cb954', // Ordinea de zi
]

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Deputy = {
  politician_id: string
  party_abbr: string | null
  party_color: string | null
  gov_role: string | null
}

async function presentIds(voteId: string): Promise<string[]> {
  // One row per deputy who voted (~230), well inside PostgREST's 1000-row clamp.
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/politician_votes?select=politician_id&vote_id=eq.${voteId}&limit=1000`,
    { headers: SB, cache: 'no-store' },
  )
  const rows: { politician_id: string }[] = (await r.json()) ?? []
  return rows.map(x => x.politician_id)
}

async function activeDeputies(): Promise<Deputy[]> {
  // politicians + parties, not deputy_stats: that view aggregates every one of
  // the ~351k politician_votes rows to produce counts this card never reads, and
  // it answers in ~4.5s — enough for the cold render to blow its budget and
  // return a 500 (the warm edge cache then hides it until the copy expires).
  // The roster itself is ~330 rows and answers in milliseconds.
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/politicians?select=id,gov_role,parties(abbreviation,color)` +
      `&chamber=eq.deputies&active=is.true&limit=1000`,
    { headers: SB, cache: 'no-store' },
  )
  const rows: { id: string; gov_role: string | null;
                parties: { abbreviation: string; color: string | null } | null }[] =
    (await r.json()) ?? []
  return rows.map(p => ({
    politician_id: p.id,
    party_abbr: p.parties?.abbreviation ?? null,
    party_color: p.parties?.color ?? null,
    gov_role: p.gov_role,
  }))
}

export async function GET(req: Request) {
  return withEdgeCache(req, () => renderCard(req))
}

async function renderCard(req: Request): Promise<Response> {
  const sp = new URL(req.url).searchParams
  const voteIds = (sp.get('v')?.split(',').filter(x => UUID.test(x)) ?? [])
  const votes = voteIds.length ? voteIds.slice(0, 4) : DEFAULT_VOTES

  const [presentLists, deputies] = await Promise.all([
    Promise.all(votes.map(presentIds)),
    activeDeputies(),
  ])

  const present = new Set(presentLists.flat())
  const absent = deputies.filter(d => !present.has(d.politician_id))

  const seats = new Map<string, number>()
  const missing = new Map<string, number>()
  const colors = new Map<string, string>()
  for (const d of deputies) {
    const abbr = d.party_abbr || 'IND'
    seats.set(abbr, (seats.get(abbr) ?? 0) + 1)
    if (d.party_color) colors.set(abbr, d.party_color)
  }
  for (const d of absent) {
    const abbr = d.party_abbr || 'IND'
    missing.set(abbr, (missing.get(abbr) ?? 0) + 1)
  }

  const parties: PartyRow[] = [...seats.entries()]
    .map(([abbr, s]) => ({
      abbr,
      color: colors.get(abbr) ?? '#9e9e9e',
      absent: missing.get(abbr) ?? 0,
      seats: s,
      pct: Math.round(((missing.get(abbr) ?? 0) / s) * 100),
    }))
    .sort((a, b) => b.pct - a.pct || b.absent - a.absent)

  // Ministers are MPs who do not sit in plenary; they are inside the headline
  // count (they are on the roster) but naming that on the card is the difference
  // between a statistic and a fair one.
  const ministers = absent.filter(d => d.gov_role).length

  const data: SessionOpenCardData = {
    dateLabel: (sp.get('label') ?? '27 iulie 2026 · camera deputaților').slice(0, 60),
    absent: absent.length,
    total: deputies.length,
    headline: (sp.get('headline') ?? 'deputați n-au votat la deschiderea sesiunii extraordinare').slice(0, 90),
    note: ministers > 0
      ? `Bara arată cât din mandatele grupului au lipsit. ${ministers} dintre cei absenți sunt membri ai Guvernului. Lista pe nume: la-butoane.ro`
      : 'Bara arată cât din mandatele grupului au lipsit. Lista pe nume: la-butoane.ro',
    parties,
  }

  const fonts = await getCardFonts()
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: 1080, height: 1350 }}>
        <SessionOpenCard data={data} />
      </div>
    ),
    { width: 1080, height: 1350, fonts },
  )
}
