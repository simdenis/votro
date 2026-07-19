import { ImageResponse } from 'next/og'
import { TacitListCard, type TacitEntry } from '@/components/cards/tacit-list-card'
import { getCardFonts } from '@/lib/og-fonts'

// 1080×1350 "pe cale să treacă tacit" — pending bills expiring in ≤7 days,
// soonest first, top 10. Light render (no hemicycle) → fine on the CPU cap.
// NOT edge-cached: the deadline countdown changes daily; the admin page adds
// a ?d=YYYY-MM-DD param so IG/browsers fetch fresh per day anyway.

const U = process.env.NEXT_PUBLIC_SUPABASE_URL!
const K = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SB = { apikey: K, Authorization: `Bearer ${K}` }

const RO_MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
                   'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie']

export async function GET() {
  const today = new Date()
  const iso = today.toISOString().slice(0, 10)
  const limitDate = new Date(today.getTime() + 7 * 86400_000).toISOString().slice(0, 10)
  // hottest first (Gemini score via pending_bills_scorer), deadline as tiebreak
  const rows: { code: string; title: string | null; chamber: string; tacit_deadline: string; interest_score: number | null }[] =
    (await (await fetch(
      `${U}/rest/v1/pending_bills?select=code,title,chamber,tacit_deadline,interest_score` +
      `&tacit_deadline=gte.${iso}&tacit_deadline=lte.${limitDate}` +
      `&order=interest_score.desc.nullslast,tacit_deadline.asc&limit=10`,
      { headers: SB })).json()) ?? []

  const entries: TacitEntry[] = rows.map(r => ({
    code: r.code,
    title: r.title ?? '',
    chamber: r.chamber === 'senate' ? 'SENAT' : 'CAMERĂ',
    daysLeft: Math.max(0, Math.round((new Date(r.tacit_deadline).getTime() - today.getTime()) / 86400_000)),
    interest: r.interest_score,
  }))

  const fonts = await getCardFonts()
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: 1080, height: 1350, transform: 'scale(2)', transformOrigin: 'top left' }}>
        <TacitListCard data={{
          dateLabel: `${today.getDate()} ${RO_MONTHS[today.getMonth()]} ${today.getFullYear()}`,
          entries,
        }} />
      </div>
    ),
    { width: 2160, height: 2700, fonts },
  )
}
