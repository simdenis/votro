import { ImageResponse } from 'next/og'
import { isUuid } from '@/lib/utils'


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
  const idParam = searchParams.get('id')
  const id = isUuid(idParam) ? idParam : null

  const vote = id ? await fetchVote(id) : null
  const code   = vote?.laws?.code  ?? 'LaButoane'
  const title  = vote?.laws?.title ?? vote?.description ?? 'Transparență parlamentară'
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
          background: '#FFFFFF',
          display: 'flex', flexDirection: 'column',
          padding: '56px 64px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* LaButoane wordmark */}
        <div style={{ fontSize: 22, color: '#B0B4BA', fontWeight: 700, letterSpacing: 1, marginBottom: 'auto' }}>
          la-butoane.ro
        </div>

        {/* Law code */}
        <div style={{ fontSize: 52, fontWeight: 900, color: '#171A1F', letterSpacing: '-1px', marginBottom: 16 }}>
          {code}
        </div>

        {/* Law title */}
        <div style={{ fontSize: 28, color: '#6E7480', lineHeight: 1.35, marginBottom: 40 }}>
          {short}
        </div>

        {/* Counts row */}
        <div style={{ display: 'flex', gap: 48, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 48, fontWeight: 900, color: '#2EA871' }}>{forC}</span>
            <span style={{ fontSize: 14, color: '#8A8F98', textTransform: 'uppercase', letterSpacing: 2 }}>PENTRU</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 48, fontWeight: 900, color: '#D64545' }}>{agaC}</span>
            <span style={{ fontSize: 14, color: '#8A8F98', textTransform: 'uppercase', letterSpacing: 2 }}>ÎMPOTRIVĂ</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 48, fontWeight: 900, color: '#8A8F98' }}>{absC}</span>
            <span style={{ fontSize: 14, color: '#8A8F98', textTransform: 'uppercase', letterSpacing: 2 }}>ABȚINERI</span>
          </div>
          {outcome && (
            <div
              style={{
                marginLeft: 'auto',
                padding: '10px 24px',
                borderRadius: 8,
                background: outcome === 'adoptat' ? '#E7F5EE' : '#FBEAE7',
                color: outcome === 'adoptat' ? '#1F7A51' : '#C0392B',
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
