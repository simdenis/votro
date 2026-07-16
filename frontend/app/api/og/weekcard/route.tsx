import { ImageResponse } from 'next/og'
import { WeekCard, type WeekCardData, type WeekHighlight } from '@/components/cards/week-card'
import { getCardFonts } from '@/lib/og-fonts'
import { lastSessionRange } from '@/lib/utils'

// 1080×1350 (4:5) weekly recap — /api/og/weekcard  (last 7 days; ?to=YYYY-MM-DD to pin the end)
// During recess an empty week auto-falls back to a recap of the whole
// just-ended session, so the weekly IG post never renders a zero card.


const U = process.env.NEXT_PUBLIC_SUPABASE_URL!
const K = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SB = { apikey: K, Authorization: `Bearer ${K}` }

const MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie']

function rangeLabel(from: Date, to: Date): string {
  const f = `${from.getUTCDate()}${from.getUTCMonth() !== to.getUTCMonth() ? ' ' + MONTHS[from.getUTCMonth()] : ''}`
  return `${f}–${to.getUTCDate()} ${MONTHS[to.getUTCMonth()]} ${to.getUTCFullYear()}`
}

async function fetchRange(fromISO: string, toISO: string) {
  const [votesRes, devRes] = await Promise.all([
    fetch(
      `${U}/rest/v1/votes?vote_date=gte.${fromISO}&vote_date=lte.${toISO}` +
        `&select=id,chamber,outcome,for_count,against_count,description,laws(code,title)`,
      { headers: SB },
    ),
    fetch(
      `${U}/rest/v1/politician_votes?party_line_deviation=eq.true&select=id,votes!inner(vote_date)` +
        `&votes.vote_date=gte.${fromISO}&votes.vote_date=lte.${toISO}&limit=1`,
      { headers: { ...SB, Prefer: 'count=exact' } },
    ),
  ])
  const votes: any[] = (await votesRes.json()) ?? []
  const devRange = devRes.headers.get('content-range')?.split('/')[1]
  const deviations = devRange && devRange !== '*' ? Number(devRange) : 0
  return { votes, deviations }
}

export async function GET(request: Request) {
  const toParam = new URL(request.url).searchParams.get('to')
  const toDate = toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam) ? new Date(`${toParam}T00:00:00Z`) : null
  const to = toDate && !Number.isNaN(toDate.getTime()) ? toDate : new Date()
  const from = new Date(to.getTime() - 6 * 86_400_000)

  let { votes, deviations } = await fetchRange(from.toISOString().slice(0, 10), to.toISOString().slice(0, 10))
  let rangeText: string | null = null
  let labels: Pick<WeekCardData, 'kicker' | 'title' | 'highlightLabel'> = {}

  // Recess fallback: empty week + vacation calendar → whole-session recap
  const session = votes.length === 0 && !toParam ? lastSessionRange() : null
  if (session) {
    ;({ votes, deviations } = await fetchRange(session.from, session.to))
    rangeText = session.label
    labels = { kicker: 'RECAP SESIUNE', title: 'Sesiunea în Parlament', highlightLabel: 'Cel mai strâns vot al sesiunii' }
  }

  const decided = votes.filter(v => v.outcome && (v.for_count ?? 0) + (v.against_count ?? 0) > 20)
  // prefer votes on actual bills — a procedural "vot de plen" is a dull highlight
  const pool = decided.filter(v => v.laws?.title).length ? decided.filter(v => v.laws?.title) : decided
  const closestVote = pool.length
    ? pool.reduce((a, b) =>
        Math.abs((a.for_count ?? 0) - (a.against_count ?? 0)) <= Math.abs((b.for_count ?? 0) - (b.against_count ?? 0)) ? a : b)
    : null

  const closest: WeekHighlight | null = closestVote
    ? {
        lawCode: closestVote.laws?.code ?? 'VOT DE PLEN',
        lawTitle: closestVote.laws?.title ?? closestVote.description ?? 'Vot fără lege asociată',
        chamber: closestVote.chamber === 'deputies' ? 'CAMERĂ' : 'SENAT',
        outcome: closestVote.outcome === 'respins' ? 'RESPINS' : 'ADOPTAT',
        votesFor: closestVote.for_count ?? 0,
        votesAgainst: closestVote.against_count ?? 0,
      }
    : null

  const data: WeekCardData = {
    ...labels,
    rangeLabel: rangeText ?? rangeLabel(from, to),
    totalVotes: votes.length,
    adopted: votes.filter(v => v.outcome === 'adoptat').length,
    rejected: votes.filter(v => v.outcome === 'respins').length,
    deviations,
    senateVotes: votes.filter(v => v.chamber === 'senate').length,
    cameraVotes: votes.filter(v => v.chamber === 'deputies').length,
    closest,
  }

  const fonts = await getCardFonts()
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: 1080, height: 1350, transform: 'scale(2)', transformOrigin: 'top left' }}>
        <WeekCard data={data} />
      </div>
    ),
    { width: 2160, height: 2700, fonts },
  )
}
