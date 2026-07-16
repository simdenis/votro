import { ImageResponse } from 'next/og'
import { StructuraCard, type PartySeats, type StructuraCardData } from '@/components/cards/structura-card'
import { getCardFonts } from '@/lib/og-fonts'

// 1080×1350 (4:5) structure carousel (post #3: cine stă la butoane).
// URL: /api/og/structura?slide=1..4 — seat counts come live from the roster.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

interface Row {
  chamber: 'senate' | 'deputies'
  parties: { abbreviation: string; name: string; color: string | null } | null
}

async function seatsByParty(): Promise<{ senate: PartySeats[]; camera: PartySeats[] }> {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/politicians?select=chamber,parties(abbreviation,name,color)&active=is.true`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
  )
  const rows: Row[] = await r.json()

  const acc: Record<string, Record<string, PartySeats>> = { senate: {}, deputies: {} }
  for (const row of rows) {
    if (!row.parties) continue
    const p = row.parties
    const bucket = acc[row.chamber]
    bucket[p.abbreviation] ??= { abbr: p.abbreviation, name: p.name, color: p.color ?? '#9AA0AA', seats: 0 }
    bucket[p.abbreviation].seats++
  }
  const sorted = (b: Record<string, PartySeats>) => Object.values(b).sort((a, z) => z.seats - a.seats)
  return { senate: sorted(acc.senate), camera: sorted(acc.deputies) }
}

export async function GET(request: Request) {
  const slide = Math.min(4, Math.max(1, Number(new URL(request.url).searchParams.get('slide')) || 1))
  const { senate, camera } = await seatsByParty()
  const data: StructuraCardData = { slide, senate, camera }

  const fonts = await getCardFonts()
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: 1080, height: 1350, transform: 'scale(2)', transformOrigin: 'top left' }}>
        <StructuraCard data={data} />
      </div>
    ),
    { width: 2160, height: 2700, fonts },
  )
}
