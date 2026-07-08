import { ImageResponse } from 'next/og'
import { ShameCard, type ShameCardData, type ShameEntry } from '@/components/cards/shame-card'
import { getCardFonts } from '@/lib/og-fonts'

// 1080×1080 Instagram shame-corner card — top absentees, both chambers.
// Public URL the Instagram poster fetches: /api/og/shamecard

export const runtime = 'edge'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SB = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }

const MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
                'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie']

async function fetchWorst(view: string, chamber: ShameEntry['chamber']): Promise<ShameEntry[]> {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/${view}?select=name,first_name,party_abbr,party_color,presence_pct` +
      `&active=eq.true&gov_role=is.null&order=presence_pct.asc&limit=5`,
    { headers: SB },
  )
  const rows: any[] = (await r.json()) ?? []
  return rows.map(s => ({
    name: `${s.first_name} ${s.name}`,
    partyAbbr: s.party_abbr,
    partyColor: s.party_color || '#9e9e9e',
    chamber,
    absencePct: Math.round(100 - (s.presence_pct ?? 100)),
  }))
}

export async function GET() {
  const [senators, deputies] = await Promise.all([
    fetchWorst('senator_stats', 'SENAT'),
    fetchWorst('deputy_stats', 'CAMERĂ'),
  ])
  const now = new Date()
  const data: ShameCardData = {
    dateLabel: `${MONTHS[now.getMonth()]} ${now.getFullYear()}`,
    entries: [...senators, ...deputies].sort((a, b) => b.absencePct - a.absencePct).slice(0, 5),
  }

  const fonts = await getCardFonts()
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: 1080, height: 1080, transform: 'scale(2)', transformOrigin: 'top left' }}>
        <ShameCard data={data} />
      </div>
    ),
    { width: 2160, height: 2160, fonts },
  )
}
