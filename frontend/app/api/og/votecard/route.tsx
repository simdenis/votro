import { ImageResponse } from 'next/og'
import { VoteCard, type VoteCardData } from '@/components/cards/vote-card'
import { mapVoteToCard, SAMPLE_VOTE_CARD } from '@/lib/votecard'
import { getCardFonts } from '@/lib/og-fonts'
import { isUuid } from '@/lib/utils'
import { activeSeats, activeSeatsByParty } from '@/lib/seats'

// 1080×1350 (4:5) Instagram vote card — Satori export pipeline.
// Public URL the Instagram poster fetches: /api/og/votecard?vote=<vote_id>


const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SB = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }

async function fetchVote(id: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/votes?id=eq.${id}&select=*,laws(*)&limit=1`, { headers: SB })
  return (await r.json())?.[0] ?? null
}
async function fetchBreakdown(id: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/party_vote_breakdown?vote_id=eq.${id}&select=party_abbr,vote_choice,count`, { headers: SB })
  return (await r.json()) ?? []
}
export async function GET(request: Request) {
  const idParam = new URL(request.url).searchParams.get('vote')
  const id = isUuid(idParam) ? idParam : null
  const vote = id ? await fetchVote(id) : null

  const chamber = vote?.chamber as 'senate' | 'deputies' | undefined
  const data: VoteCardData = vote
    ? mapVoteToCard(
        vote,
        await fetchBreakdown(id!),
        await activeSeats(chamber!),
        await activeSeatsByParty(chamber!),
      )
    : SAMPLE_VOTE_CARD

  const fonts = await getCardFonts()
  // Render at 2× (2160px) — a 1080px PNG looks soft on hi-dpi screens.
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: 1080, height: 1350, transform: 'scale(2)', transformOrigin: 'top left' }}>
        <VoteCard data={data} />
      </div>
    ),
    { width: 2160, height: 2700, fonts },
  )
}
