import { ImageResponse } from 'next/og'
import { LawCard, type LawCardData } from '@/components/cards/law-card'
import { mapLawToCard, lawDecisiveVoteId } from '@/lib/votecard'
import { getCardFonts } from '@/lib/og-fonts'
import { isUuid } from '@/lib/utils'
import type { LawStatus } from '@/lib/types'

export const runtime = 'edge'

const U = process.env.NEXT_PUBLIC_SUPABASE_URL!
const K = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SB = { apikey: K, Authorization: `Bearer ${K}` }

const SAMPLE: LawCardData = {
  lawCode: 'L 412/2026', lawTitle: 'Lege privind transparența deciziilor parlamentare', category: 'Administrație', year: 2026,
  statusLabel: 'PROMULGATĂ', statusColor: '#171A1F', dateLine: 'Promulgată · 24 mai 2026',
  journey: [
    { label: 'Senat', done: true },
    { label: 'Cameră', done: true },
    { label: 'Lege', done: true, final: true },
  ],
  voteChamber: 'CAMERA DEPUTAȚILOR', votesFor: 187, votesAgainst: 45, votesAbstain: 12,
  parties: [
    { name: 'PSD', for: 60, against: 2, abstain: 1, absent: 5 },
    { name: 'PNL', for: 50, against: 1, abstain: 2, absent: 4 },
    { name: 'AUR', for: 5, against: 30, abstain: 3, absent: 6 },
    { name: 'USR', for: 40, against: 2, abstain: 1, absent: 3 },
    { name: 'UDMR', for: 18, against: 1, abstain: 1, absent: 2 },
  ],
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const idParam = url.searchParams.get('id')
  const id = isUuid(idParam) ? idParam : null
  // ?chamber=senate|camera pins the party-vote section — two IG carousel
  // slides for laws voted in both chambers. Default: decisive vote.
  const chamberParam = url.searchParams.get('chamber')
  const forChamber = chamberParam === 'senate' || chamberParam === 'camera' ? chamberParam : null

  const law = id
    ? ((await (await fetch(`${U}/rest/v1/law_status?law_id=eq.${id}&select=*&limit=1`, { headers: SB })).json())?.[0] as LawStatus | undefined)
    : undefined

  let breakdown: { party_abbr: string; vote_choice: string; count: number }[] = []
  const decisive = law
    ? forChamber
      ? (forChamber === 'camera' && law.camera_vote_id ? { voteId: law.camera_vote_id }
        : forChamber === 'senate' && law.senate_vote_id ? { voteId: law.senate_vote_id }
        : null)
      : lawDecisiveVoteId(law)
    : null
  if (decisive) {
    const r = await fetch(
      `${U}/rest/v1/party_vote_breakdown?vote_id=eq.${decisive.voteId}&select=party_abbr,vote_choice,count`,
      { headers: SB },
    )
    breakdown = (await r.json()) ?? []
  }

  const data = law ? mapLawToCard(law, breakdown, forChamber) : SAMPLE
  const fonts = await getCardFonts()
  // Render at 2× (2160px) — a 1080px PNG looks soft on hi-dpi screens.
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: 1080, height: 1080, transform: 'scale(2)', transformOrigin: 'top left' }}>
        <LawCard data={data} />
      </div>
    ),
    { width: 2160, height: 2160, fonts },
  )
}
