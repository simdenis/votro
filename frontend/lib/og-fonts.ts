// Shared font loader for the card routes (Satori / next-og).
// Fonts are VENDORED in public/assets/fonts and loaded at request time from the
// Cloudflare ASSETS binding — no Google Fonts fetch at runtime. (The old runtime
// fetch to Google intermittently died with 'Network connection lost' on cold
// edge isolates; the earlier import.meta.url fetch resolved to a file:// URL,
// which workerd refuses to fetch — so both prior approaches are gone.)
//
// 'Plex Display' is IBM Plex Sans 700 registered under its own family name:
// card titles set only fontFamily (no fontWeight), and Satori then picks the
// single face registered for that family — bold headlines with zero per-style
// weight plumbing.

type FontWeight = 400 | 500 | 600 | 700
interface OgFont { name: string; data: ArrayBuffer; weight: FontWeight; style: 'normal' }

/** Read a vendored font. On Cloudflare (Workers) go through the ASSETS binding
 *  — no network, served from the same worker's asset store. Fall back to a
 *  same-origin fetch for `next dev` / any non-Cloudflare runtime. */
async function loadFont(file: string): Promise<ArrayBuffer> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const { env } = getCloudflareContext()
    const assets = (env as { ASSETS?: { fetch: (url: URL) => Promise<Response> } }).ASSETS
    if (assets) {
      const res = await assets.fetch(new URL(`/assets/fonts/${file}`, 'https://assets.local'))
      if (res.ok) return res.arrayBuffer()
    }
  } catch {
    // not on Cloudflare (e.g. `next dev`) — fall through to origin fetch
  }
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const res = await fetch(`${base}/assets/fonts/${file}`)
  return res.arrayBuffer()
}

let cache: Promise<OgFont[]> | null = null

export function getCardFonts(): Promise<OgFont[]> {
  return (cache ??= (async () => {
    const [s4, s5, s6, s7, m4, m5] = await Promise.all([
      loadFont('plex-sans-400.ttf'),
      loadFont('plex-sans-500.ttf'),
      loadFont('plex-sans-600.ttf'),
      loadFont('plex-sans-700.ttf'),
      loadFont('plex-mono-400.ttf'),
      loadFont('plex-mono-500.ttf'),
    ])
    return [
      { name: 'Plex Display', data: s7, weight: 400, style: 'normal' },
      { name: 'IBM Plex Sans', data: s4, weight: 400, style: 'normal' },
      { name: 'IBM Plex Sans', data: s5, weight: 500, style: 'normal' },
      { name: 'IBM Plex Sans', data: s6, weight: 600, style: 'normal' },
      { name: 'IBM Plex Sans', data: s7, weight: 700, style: 'normal' },
      { name: 'IBM Plex Mono', data: m4, weight: 400, style: 'normal' },
      { name: 'IBM Plex Mono', data: m5, weight: 500, style: 'normal' },
    ] as OgFont[]
  })())
}
