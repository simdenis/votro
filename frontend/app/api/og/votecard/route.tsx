import { ImageResponse } from 'next/og'
import { VoteCard, type VoteCardData } from '@/components/cards/vote-card'
import { mapVoteToCard, SAMPLE_VOTE_CARD } from '@/lib/votecard'

// 1080×1080 Instagram vote card — Satori export pipeline.
// Public URL the Instagram poster fetches: /api/og/votecard?vote=<vote_id>

export const runtime = 'edge'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SB = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }

// Force TTF (Satori can't read woff2) via an old User-Agent to Google Fonts.
async function loadFont(family: string, weight: number): Promise<ArrayBuffer> {
  const css = await (
    await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; rv:1.9) Gecko/20100101 Firefox/3.5' },
    })
  ).text()
  const m = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/)
  if (!m) throw new Error(`font not found: ${family} ${weight}`)
  return (await fetch(m[1])).arrayBuffer()
}

let fontsPromise: ReturnType<typeof buildFonts> | null = null
async function buildFonts() {
  const [serif, s4, s5, s6] = await Promise.all([
    loadFont('DM Serif Display', 400),
    loadFont('DM Sans', 400),
    loadFont('DM Sans', 500),
    loadFont('DM Sans', 600),
  ])
  return [
    { name: 'DM Serif Display', data: serif, weight: 400 as const, style: 'normal' as const },
    { name: 'DM Sans', data: s4, weight: 400 as const, style: 'normal' as const },
    { name: 'DM Sans', data: s5, weight: 500 as const, style: 'normal' as const },
    { name: 'DM Sans', data: s6, weight: 600 as const, style: 'normal' as const },
  ]
}
function getFonts() {
  return (fontsPromise ??= buildFonts())
}

async function fetchVote(id: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/votes?id=eq.${id}&select=*,laws(*)&limit=1`, { headers: SB })
  return (await r.json())?.[0] ?? null
}
async function fetchBreakdown(id: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/party_vote_breakdown?vote_id=eq.${id}&select=party_abbr,vote_choice,count`, { headers: SB })
  return (await r.json()) ?? []
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('vote')
  const vote = id ? await fetchVote(id) : null

  const data: VoteCardData = vote
    ? mapVoteToCard(vote, await fetchBreakdown(id!))
    : SAMPLE_VOTE_CARD

  const fonts = await getFonts()
  return new ImageResponse(<VoteCard data={data} />, { width: 1080, height: 1080, fonts })
}
