import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%',
          background: '#111111',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 96, fontWeight: 900, color: '#ffffff', letterSpacing: '-4px' }}>
          VotRO
        </div>
        <div style={{ fontSize: 28, color: '#888888', marginTop: 16 }}>
          Cum votează parlamentarii români
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
