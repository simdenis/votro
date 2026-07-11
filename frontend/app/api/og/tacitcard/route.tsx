import { ImageResponse } from 'next/og'
import { TacitCard, type TacitCardData } from '@/components/cards/tacit-card'
import { getCardFonts } from '@/lib/og-fonts'
import { capFirst, isUuid } from '@/lib/utils'
import { activeSeats } from '@/lib/seats'
import { formatDate } from '@/lib/utils'

// 1080×1350 (4:5) tacit-adoption card. A chamber qualifies when the law moved past
// Parliament (presidential_status set) yet has no plenary vote there.
// URL: /api/og/tacitcard?id=<law_id>[&chamber=senate|camera]

export const runtime = 'edge'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SB = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }

async function fetchLaw(id: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/law_status?law_id=eq.${id}&select=*&limit=1`, { headers: SB })
  return (await r.json())?.[0] ?? null
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const idParam = url.searchParams.get('id')
  const chamberParam = url.searchParams.get('chamber') // 'senate' | 'camera' | null
  const law = isUuid(idParam) ? await fetchLaw(idParam!) : null

  let data: TacitCardData
  if (law) {
    const passed = !!law.presidential_status
    const senateTacit = passed && !law.senate_vote_id
    const cameraTacit = passed && !law.camera_vote_id
    const chamber: 'senate' | 'deputies' =
      chamberParam === 'camera' && cameraTacit ? 'deputies'
      : chamberParam === 'senate' && senateTacit ? 'senate'
      : senateTacit ? 'senate'
      : 'deputies'
    const dateForYear = law.presidential_date || law.camera_vote_date || law.senate_vote_date
    // the moment the law moved on: the other chamber's vote, or promulgation
    const nextStep = chamber === 'senate' ? law.camera_vote_date : law.senate_vote_date
    data = {
      lawCode: law.code,
      lawTitle: capFirst(law.title) || '—',
      chamber: chamber === 'senate' ? 'SENAT' : 'CAMERA DEPUTAȚILOR',
      year: dateForYear ? new Date(dateForYear).getFullYear() : new Date().getFullYear(),
      seats: await activeSeats(chamber),
      dateLine: nextStep
        ? `a mers mai departe · ${formatDate(nextStep)}`
        : law.presidential_date
          ? `promulgată · ${formatDate(law.presidential_date)}`
          : null,
    }
  } else {
    data = {
      lawCode: 'L 000/2026',
      lawTitle: 'Exemplu de lege adoptată tacit',
      chamber: 'SENAT',
      year: 2026,
      seats: 134,
      dateLine: null,
    }
  }

  const fonts = await getCardFonts()
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: 1080, height: 1350, transform: 'scale(2)', transformOrigin: 'top left' }}>
        <TacitCard data={data} />
      </div>
    ),
    { width: 2160, height: 2700, fonts },
  )
}
