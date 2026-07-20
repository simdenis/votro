import { ImageResponse } from 'next/og'
import { getCardFonts } from '@/lib/og-fonts'
import { withEdgeCache } from '@/lib/og-edge-cache'

// 1080×1920 (9:16) STORY frame for any card. Instead of redesigning every card
// for stories, this wraps an existing 4:5 card image (rendered by its own
// /api/og route) centered on a branded 9:16 canvas — one route, all cards.
//   /api/og/story?src=<url-encoded card image URL>
// The publish flow appends this when posting a story so IG gets a native 9:16
// image (no letterboxing). src is restricted to our own /api/og/* cards.

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://la-butoane.ro').replace(/\/$/, '')
const MONO = 'IBM Plex Mono'
const SANS = 'IBM Plex Sans'

export async function GET(req: Request) {
  return withEdgeCache(req, () => render(req))
}

async function render(req: Request): Promise<Response> {
  const src = new URL(req.url).searchParams.get('src') ?? ''
  // only frame our own og cards (never an arbitrary remote image)
  let card: URL
  try { card = new URL(src) } catch { return new Response('bad src', { status: 400 }) }
  const ok = (card.origin === SITE || card.origin === new URL(req.url).origin) && card.pathname.startsWith('/api/og/')
  if (!ok) return new Response('src must be an own /api/og card', { status: 400 })

  // Render at 1× (1080×1920). Stories display ~1080px wide, and embedding +
  // rescaling the full-res card PNG onto a 2× canvas blew the CPU cap (1102).
  const fonts = await getCardFonts()
  return new ImageResponse(
    (
      <div style={{
        width: 1080, height: 1920, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', background: '#EDEFF1', fontFamily: SANS,
      }}>
        {/* brand strip top */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'absolute', top: 84 }}>
          <svg width="34" height="34" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#171A1F" /><rect x="11" y="11" width="18" height="18" rx="6" fill="#2EA871" /><rect x="35" y="11" width="18" height="18" rx="6" fill="#E3A23C" /><rect x="11" y="35" width="18" height="18" rx="6" fill="#EE7B5E" /><rect x="35" y="35" width="18" height="18" rx="6" fill="#4E86D8" /></svg>
          <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 30, color: '#171A1F' }}>
            <span style={{ fontWeight: 400 }}>La</span><span style={{ fontWeight: 700 }}>Butoane</span>
          </div>
        </div>

        {/* the card, centered, soft shadow so it reads as a card */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={1000} height={1250} alt=""
             style={{ borderRadius: 22, boxShadow: '0 18px 50px rgba(23,26,31,0.18)' }} />

        {/* prompt bottom */}
        <div style={{ display: 'flex', alignItems: 'center', position: 'absolute', bottom: 110 }}>
          <div style={{ display: 'flex', fontFamily: MONO, fontSize: 24, color: '#6E7480', letterSpacing: 1 }}>detalii pe la-butoane.ro</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1920, fonts },
  )
}
