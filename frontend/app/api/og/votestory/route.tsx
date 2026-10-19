import { ImageResponse } from 'next/og'
import { VoteStory, type VoteStoryData } from '@/components/cards/vote-story'
import { mapVoteToCard } from '@/lib/votecard'
import { getCardFonts } from '@/lib/og-fonts'
import { isUuid, plainSummary } from '@/lib/utils'
import { activeSeats, activeSeatsByParty } from '@/lib/seats'
import { withEdgeCache } from '@/lib/og-edge-cache'
import { nextAfterVote } from '@/lib/next-step'

// 1080×1920 native story for one final vote: /api/og/votestory?vote=<vote_id>.
// Designed for 9:16 (not a 4:5 card in the story frame), so auto_post posts it
// as-is. Headline = the final-text explainer's title, else the AI headline.

const U = process.env.NEXT_PUBLIC_SUPABASE_URL!
const K = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SB = { apikey: K, Authorization: `Bearer ${K}` }

const get = (path: string) => fetch(`${U}/rest/v1/${path}`, { headers: SB }).then(r => r.json()).catch(() => null)

async function render(request: Request): Promise<Response> {
  const idParam = new URL(request.url).searchParams.get('vote')
  const id = isUuid(idParam) ? idParam : null
  if (!id) return new Response('vote id required', { status: 400 })
  const vote = (await get(`votes?id=eq.${id}&select=*,laws(*)&limit=1`))?.[0]
  if (!vote?.laws) return new Response('Not found', { status: 404 })

  const chamber = vote.chamber as 'senate' | 'deputies'
  const [breakdown, seats, seatsByParty, lawStatus] = await Promise.all([
    get(`party_vote_breakdown?vote_id=eq.${id}&select=party_abbr,vote_choice,count`),
    activeSeats(chamber),
    activeSeatsByParty(chamber),
    get(`law_status?law_id=eq.${vote.law_id}&select=presidential_status,senate_outcome,camera_outcome&limit=1`),
  ])
  const card = mapVoteToCard(vote, breakdown ?? [], seats, seatsByParty)
  const law = vote.laws as { headline: string | null; summary: string | null; explainer: { titlu?: string; rezumat?: string } | null }
  const data: VoteStoryData = {
    chamberName: chamber === 'senate' ? 'Senat' : 'Camera Deputaților',
    dateLabel: card.dateLabel ?? '',
    lawCode: card.lawCode,
    headline: law.explainer?.titlu ?? law.headline ?? null,
    lawTitle: card.lawTitle,
    summary: law.explainer?.rezumat ?? (law.summary ? plainSummary(law.summary) : null),
    result: card.result,
    votesFor: card.votesFor,
    votesAgainst: card.votesAgainst,
    votesAbstain: card.votesAbstain,
    votesNotVoted: card.votesNotVoted,
    votesAbsent: card.votesAbsent,
    parties: card.parties,
    nextLine: nextAfterVote(vote, lawStatus?.[0] ?? null, card.lawCode),
  }

  const fonts = await getCardFonts()
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: 1080, height: 1920 }}>
        <VoteStory data={data} />
      </div>
    ),
    { width: 1080, height: 1920, fonts },
  )
}

export async function GET(request: Request) {
  return withEdgeCache(request, () => render(request))
}
