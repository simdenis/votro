import { ImageResponse } from 'next/og'
import { TacitPackCover, TacitPackPair, type TacitPackBill, type TacitPackMeta } from '@/components/cards/tacit-pack-card'
import { getCardFonts } from '@/lib/og-fonts'
import { plainSummary } from '@/lib/utils'

// 1080×1350 carousel slides for a cluster of pending bills sharing one tacit
// deadline. /api/og/tacitpack?d=2026-09-04&slide=0[&at=2026-09-01]
//   slide 0     → cover (count + deadline)
//   slide 1..N  → two bills per slide, AI summary as body
// ?at pins the reference day (countdown), same contract as og/tacitlist.
// Light render (text only) → fine on the Free-plan CPU cap. Not edge-cached:
// the countdown changes daily.

const U = process.env.NEXT_PUBLIC_SUPABASE_URL!
const K = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SB = { apikey: K, Authorization: `Bearer ${K}` }

const RO_MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
                   'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie']
const RO_DAYS = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă']

// same opener-trim as og/tacitlist — the AI summaries share one subject phrase
const deboilerplate = (s: string) => {
  const t = s.replace(/^\s*(acest proiect de lege|această lege|proiectul de lege|propunerea legislativă|prezenta lege|acest proiect)\s+/i, '')
  return t === s ? s : t.charAt(0).toUpperCase() + t.slice(1)
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const d = sp.get('d')
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return new Response('bad d', { status: 400 })
  const slide = Math.max(0, parseInt(sp.get('slide') ?? '0', 10) || 0)
  const at = sp.get('at')
  const today = at && /^\d{4}-\d{2}-\d{2}$/.test(at) ? new Date(`${at}T12:00:00Z`) : new Date()

  const rows: { code: string; chamber: string; summary: string | null; title: string | null }[] =
    (await (await fetch(
      `${U}/rest/v1/pending_bills?select=code,chamber,summary,title&tacit_deadline=eq.${d}&order=code`,
      { headers: SB })).json()) ?? []
  if (!rows.length) return new Response('no bills', { status: 404 })

  const deadline = new Date(`${d}T12:00:00Z`)
  const slides = 1 + Math.ceil(rows.length / 2)
  if (slide >= slides) return new Response('no slide', { status: 404 })

  const meta: TacitPackMeta = {
    dateLabel: `${today.getUTCDate()} ${RO_MONTHS[today.getUTCMonth()]} ${today.getUTCFullYear()}`,
    deadlineLabel: `${RO_DAYS[deadline.getUTCDay()]}, ${deadline.getUTCDate()} ${RO_MONTHS[deadline.getUTCMonth()]}`,
    daysLeft: Math.max(0, Math.round((deadline.getTime() - today.getTime()) / 86400_000)),
    total: rows.length,
    slide,
    slides,
  }

  const fonts = await getCardFonts()
  let card: React.ReactElement
  if (slide === 0) {
    // what the cluster touches, from the official titles — nominative and
    // genitive both appear ("Legea nr.304/2022" / "Legii nr.303/2022")
    const targets = [...new Set(rows.flatMap(r => [...(r.title ?? '').matchAll(/Leg(?:ea|ii) nr\.(\d+\/\d{4})/g)].map(m => m[1])))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map(c => `Legea ${c}`)
    card = <TacitPackCover meta={meta} targetLine={targets.join(' · ')} />
  } else {
    const bills: TacitPackBill[] = rows.slice((slide - 1) * 2, slide * 2).map(r => ({
      code: r.code,
      chamber: r.chamber === 'senate' ? 'SENAT' : 'CAMERĂ',
      summary: deboilerplate(plainSummary(r.summary)) || r.title || '',
    }))
    card = <TacitPackPair meta={meta} bills={bills} />
  }

  return new ImageResponse(
    <div style={{ display: 'flex', width: 1080, height: 1350 }}>{card}</div>,
    { width: 1080, height: 1350, fonts },
  )
}
