import { ImageResponse } from 'next/og'

// Square 1080×1080 image for Instagram posts.
// Public URL (e.g. https://votro.ro/api/og/post?vote=<id>) is fetched by the
// Instagram Graph API when publishing — see scraper/instagram_poster.py.

export const runtime = 'edge'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function fetchVote(id: string) {
  const url = `${SUPABASE_URL}/rest/v1/votes?id=eq.${id}&select=*,laws(*)&limit=1`
  const res = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
  const rows = await res.json()
  return rows?.[0] ?? null
}

const NAVY = '#0f2464'
const FOR = '#1a7a42'
const AGAINST = '#c4362e'
const ABST = '#8a7fb0'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const voteId = searchParams.get('vote')

  const vote = voteId ? await fetchVote(voteId) : null
  const code    = vote?.laws?.code ?? 'VotRO'
  const title   = vote?.laws?.title ?? 'Transparență parlamentară'
  const short   = title.length > 120 ? title.slice(0, 120) + '…' : title
  const chamber = vote?.chamber === 'deputies' ? 'Camera Deputaților' : 'Senat'
  const outcome = vote?.outcome as 'adoptat' | 'respins' | null | undefined
  const forC    = vote?.for_count ?? 0
  const agaC    = vote?.against_count ?? 0
  const absC    = vote?.abstention_count ?? 0
  const tot     = Math.max(forC + agaC + absC, 1)

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#fafaf8', fontFamily: 'sans-serif' }}>
        {/* Header band */}
        <div style={{ display: 'flex', flexDirection: 'column', background: NAVY, padding: '52px 64px 40px' }}>
          <div style={{ fontSize: 56, fontWeight: 800, color: '#fff', letterSpacing: '-1px' }}>VotRO</div>
          <div style={{ fontSize: 22, color: 'rgba(255,255,255,.55)', letterSpacing: 4, textTransform: 'uppercase', marginTop: 6 }}>
            {`${chamber} · 2026`}
          </div>
          {/* flag stripe */}
          <div style={{ display: 'flex', height: 8, marginTop: 26, borderRadius: 3, overflow: 'hidden', gap: 2 }}>
            <div style={{ flex: 1, background: '#002B7F' }} />
            <div style={{ flex: 1, background: '#FCD116' }} />
            <div style={{ flex: 1, background: '#CE1126' }} />
          </div>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '48px 64px 56px' }}>
          <div style={{ fontSize: 34, fontWeight: 800, color: NAVY, letterSpacing: '-0.5px', marginBottom: 24 }}>{code}</div>
          <div style={{ fontSize: 46, fontWeight: 700, color: '#0a0a14', lineHeight: 1.18, marginBottom: 'auto' }}>{short}</div>

          {/* Breakdown bar */}
          <div style={{ display: 'flex', height: 22, borderRadius: 11, overflow: 'hidden', background: '#e6e5e1', marginTop: 40 }}>
            <div style={{ width: `${(forC / tot) * 100}%`, background: FOR }} />
            <div style={{ width: `${(agaC / tot) * 100}%`, background: AGAINST }} />
            <div style={{ width: `${(absC / tot) * 100}%`, background: ABST }} />
          </div>

          {/* Counts + outcome */}
          <div style={{ display: 'flex', alignItems: 'flex-end', marginTop: 32 }}>
            <div style={{ display: 'flex', gap: 56 }}>
              {[['PENTRU', forC, FOR], ['ÎMPOTRIVĂ', agaC, AGAINST], ['ABȚINERI', absC, ABST]].map(([label, val, color]) => (
                <div key={label as string} style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 64, fontWeight: 800, color: color as string, lineHeight: 1 }}>{val as number}</span>
                  <span style={{ fontSize: 20, color: '#888', textTransform: 'uppercase', letterSpacing: 2, marginTop: 8 }}>{label as string}</span>
                </div>
              ))}
            </div>
            {outcome && (
              <div style={{ marginLeft: 'auto', padding: '14px 30px', borderRadius: 10, fontSize: 30, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2,
                background: outcome === 'adoptat' ? '#eef7f2' : '#fdf0ef', color: outcome === 'adoptat' ? FOR : AGAINST }}>
                {outcome === 'adoptat' ? 'Adoptat' : 'Respins'}
              </div>
            )}
          </div>

          <div style={{ fontSize: 22, color: '#9a9aa3', marginTop: 44 }}>votro.ro · sursă oficială: cdep.ro / senat.ro</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 },
  )
}
