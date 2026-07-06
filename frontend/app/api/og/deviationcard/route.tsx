import { ImageResponse } from 'next/og'
import { DeviationCard, type DeviationCardData } from '@/components/cards/deviation-card'
import { getCardFonts } from '@/lib/og-fonts'
import { countNoun, isUuid } from '@/lib/utils'

// 1080×1080 deviation card — /api/og/deviationcard?vote=<vote_id>

export const runtime = 'edge'

const U = process.env.NEXT_PUBLIC_SUPABASE_URL!
const K = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SB = { apikey: K, Authorization: `Bearer ${K}` }

const SAMPLE: DeviationCardData = {
  lawCode: 'L 412/2026', lawTitle: 'Lege privind transparența deciziilor parlamentare',
  chamber: 'SENAT', year: 2026, memberNoun: 'senatori', verb: 'au votat',
  deviators: [
    { name: 'Maria Popescu', partyAbbr: 'PSD', partyColor: '#e8112d', choice: 'against' },
    { name: 'Ion Ionescu', partyAbbr: 'PNL', partyColor: '#ffdd00', choice: 'abstention' },
    { name: 'Andrei Georgescu', partyAbbr: 'PSD', partyColor: '#e8112d', choice: 'against' },
  ],
}

export async function GET(request: Request) {
  const idParam = new URL(request.url).searchParams.get('vote')
  const id = isUuid(idParam) ? idParam : null

  let data = SAMPLE
  if (id) {
    const [voteRes, devRes] = await Promise.all([
      fetch(`${U}/rest/v1/votes?id=eq.${id}&select=*,laws(code,title)&limit=1`, { headers: SB }),
      fetch(
        `${U}/rest/v1/politician_votes?vote_id=eq.${id}&party_line_deviation=eq.true` +
          `&select=vote_choice,politicians(name,first_name,parties(abbreviation,color))`,
        { headers: SB },
      ),
    ])
    const vote = (await voteRes.json())?.[0]
    const devs = (await devRes.json()) ?? []
    if (vote && devs.length > 0) {
      const isDep = vote.chamber === 'deputies'
      const n = devs.length
      data = {
        lawCode: vote.laws?.code ?? 'VOT DE PLEN',
        lawTitle: vote.laws?.title ?? vote.description ?? 'Vot fără lege asociată',
        chamber: isDep ? 'CAMERĂ' : 'SENAT',
        year: vote.vote_date ? new Date(vote.vote_date).getFullYear() : 2026,
        memberNoun: isDep ? countNoun(n, 'deputat', 'deputați') : countNoun(n, 'senator', 'senatori'),
        verb: n === 1 ? 'a votat' : 'au votat',
        deviators: devs.map((d: any) => ({
          name: `${d.politicians?.first_name ?? ''} ${d.politicians?.name ?? ''}`.trim(),
          partyAbbr: d.politicians?.parties?.abbreviation ?? '—',
          partyColor: d.politicians?.parties?.color ?? '#9e9e9e',
          choice: d.vote_choice,
        })),
      }
    }
  }

  const fonts = await getCardFonts()
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: 1080, height: 1080, transform: 'scale(2)', transformOrigin: 'top left' }}>
        <DeviationCard data={data} />
      </div>
    ),
    { width: 2160, height: 2160, fonts },
  )
}
