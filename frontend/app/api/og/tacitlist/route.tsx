import { ImageResponse } from 'next/og'
import { TacitListCard, type TacitEntry } from '@/components/cards/tacit-list-card'
import { getCardFonts } from '@/lib/og-fonts'
import { plainSummary } from '@/lib/utils'

// 1080×1350 "pe cale să treacă tacit" — pending bills expiring in ≤7 days,
// soonest first, top 10. Light render (no hemicycle) → fine on the CPU cap.
// NOT edge-cached: the deadline countdown changes daily; the admin page adds
// a ?d=YYYY-MM-DD param so IG/browsers fetch fresh per day anyway.

const U = process.env.NEXT_PUBLIC_SUPABASE_URL!
const K = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SB = { apikey: K, Authorization: `Bearer ${K}` }

const RO_MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
                   'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie']

/** ?at pins the countdown's reference day, clamped to [today-1, today+7] so a
 *  public URL can't render a far-off (fake) countdown under the brand. */
function refDay(at: string | null): Date {
  const now = Date.now()
  if (!at || !/^\d{4}-\d{2}-\d{2}$/.test(at)) return new Date(now)
  const t = new Date(`${at}T12:00:00Z`).getTime()
  return new Date(Math.min(Math.max(t, now - 86400_000), now + 7 * 86400_000))
}

export async function GET(req: Request) {
  // ?at=YYYY-MM-DD pins the reference day — preview a future window, and pin
  // the render on publish day so the countdown can't drift past midnight.
  const today = refDay(new URL(req.url).searchParams.get('at'))
  const iso = today.toISOString().slice(0, 10)
  const limitDate = new Date(today.getTime() + 7 * 86400_000).toISOString().slice(0, 10)
  // soonest deadline first — objective urgency, no editorial ranking
  const rows: { code: string; title: string | null; summary: string | null; chamber: string; tacit_deadline: string }[] =
    (await (await fetch(
      `${U}/rest/v1/pending_bills?select=code,title,summary,chamber,tacit_deadline` +
      `&tacit_deadline=gte.${iso}&tacit_deadline=lte.${limitDate}` +
      `&order=tacit_deadline.asc&limit=10`,
      { headers: SB })).json()) ?? []

  // AI summaries all open with the same subject ("Acest proiect de lege
  // propune…") — 10 identical openers on one list card read terribly. Drop the
  // subject, keep the verb ("Propune modificări la…"), so entries stay
  // grammatical but scannable. List-card-local: law pages keep full sentences.
  const deboilerplate = (s: string) => {
    const t = s.replace(/^\s*(acest proiect de lege|această lege|proiectul de lege|propunerea legislativă|prezenta lege|acest proiect)\s+/i, '')
    return t === s ? s : t.charAt(0).toUpperCase() + t.slice(1)
  }

  const entries: TacitEntry[] = rows.map(r => ({
    code: r.code,
    // the plain-language summary IS the title — the official title is jargon
    title: deboilerplate(plainSummary(r.summary)) || r.title || '',
    chamber: r.chamber === 'senate' ? 'SENAT' : 'CAMERĂ',
    daysLeft: Math.max(0, Math.round((new Date(r.tacit_deadline).getTime() - today.getTime()) / 86400_000)),
  }))

  const fonts = await getCardFonts()
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: 1080, height: 1350 }}>
        <TacitListCard data={{
          dateLabel: `${today.getDate()} ${RO_MONTHS[today.getMonth()]} ${today.getFullYear()}`,
          entries,
        }} />
      </div>
    ),
    { width: 1080, height: 1350, fonts },
  )
}
