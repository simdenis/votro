import { ImageResponse } from 'next/og'

export const runtime = 'edge'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function fetchVote(id: string) {
  const url = `${SUPABASE_URL}/rest/v1/votes?id=eq.${id}&select=*,laws(*)&limit=1`
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  const rows = await res.json()
  return rows?.[0] ?? null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  const vote = id ? await fetchVote(id) : null
  const code   = vote?.laws?.code  ?? 'VotRO'
  const title  = vote?.laws?.title ?? 'Transparență parlamentară'
  const short  = title.length > 72 ? title.slice(0, 72) + '…' : title
  const outcome = vote?.outcome
  const forC   = vote?.for_count   ?? 0
  const agaC   = vote?.against_count ?? 0
  const absC   = vote?.abstention_count ?? 0

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
        {/* VotRO wordmark */}
        <div style={{ fontSize: 22, color: '#888888', fontWeight: 700, letterSpacing: 2, marginBottom: 'auto' }}>
          VOTRO
        </div>

        {/* Law code */}
        <div style={{ fontSize: 52, fontWeight: 900, color: '#ffffff', letterSpacing: '-1px', marginBottom: 16 }}>
          {code}
        </div>

        {/* Law title */}
        <div style={{ fontSize: 28, color: '#aaaaaa', lineHeight: 1.35, marginBottom: 40 }}>
          {short}
        </div>

        {/* Counts row */}
        <div style={{ display: 'flex', gap: 48, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 48, fontWeight: 900, color: '#22c55e' }}>{forC}</span>
            <span style={{ fontSize: 14, color: '#666', textTransform: 'uppercase', letterSpacing: 2 }}>PENTRU</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 48, fontWeight: 900, color: '#ef4444' }}>{agaC}</span>
            <span style={{ fontSize: 14, color: '#666', textTransform: 'uppercase', letterSpacing: 2 }}>ÎMPOTRIVĂ</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 48, fontWeight: 900, color: '#888888' }}>{absC}</span>
            <span style={{ fontSize: 14, color: '#666', textTransform: 'uppercase', letterSpacing: 2 }}>ABȚINERI</span>
          </div>
          {outcome && (
            <div
              style={{
                marginLeft: 'auto',
                padding: '10px 24px',
                borderRadius: 8,
                background: outcome === 'adoptat' ? '#166534' : '#7f1d1d',
                color: outcome === 'adoptat' ? '#22c55e' : '#ef4444',
                fontSize: 20,
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: 3,
              }}
            >
              {outcome === 'adoptat' ? 'ADOPTAT' : 'RESPINS'}
            </div>
          )}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
