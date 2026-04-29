import { ImageResponse } from 'next/og'

export const runtime = 'edge'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function fetchSenator(id: string) {
  const url = `${SUPABASE_URL}/rest/v1/senator_stats?politician_id=eq.${id}&limit=1`
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  const rows = await res.json()
  return rows?.[0] ?? null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  const s = id ? await fetchSenator(id) : null
  const name      = s ? `${s.first_name} ${s.name}` : 'Senator'
  const party     = s?.party_abbr  ?? ''
  const color     = s?.party_color ?? '#9e9e9e'
  const devPct    = s?.deviation_pct != null ? s.deviation_pct : null
  const totalV    = s?.total_votes ?? 0
  const isHighDev = devPct != null && devPct > 10

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%',
          background: '#111111',
          display: 'flex', flexDirection: 'column',
          padding: '56px 64px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Party badge */}
        {party && (
          <div
            style={{
              display: 'inline-flex', alignSelf: 'flex-start',
              padding: '6px 18px', borderRadius: 999,
              background: color, color: color === '#ffdd00' ? '#000' : '#fff',
              fontSize: 20, fontWeight: 900, letterSpacing: 1,
              marginBottom: 24,
            }}
          >
            {party}
          </div>
        )}

        {/* Name */}
        <div
          style={{
            fontSize: 64, fontWeight: 900, color: '#ffffff',
            letterSpacing: '-2px', lineHeight: 1.1, marginBottom: 'auto',
          }}
        >
          {name}
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 56, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 48, fontWeight: 900, color: '#ffffff' }}>{totalV}</span>
            <span style={{ fontSize: 14, color: '#666', textTransform: 'uppercase', letterSpacing: 2 }}>VOTURI</span>
          </div>
          {devPct != null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 48, fontWeight: 900, color: isHighDev ? '#f59e0b' : '#ffffff' }}>
                {devPct.toFixed(1)}%
              </span>
              <span style={{ fontSize: 14, color: '#666', textTransform: 'uppercase', letterSpacing: 2 }}>DEVIERE</span>
            </div>
          )}
          <div style={{ marginLeft: 'auto', fontSize: 22, color: '#555', fontWeight: 700, letterSpacing: 2 }}>
            VOTRO
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
