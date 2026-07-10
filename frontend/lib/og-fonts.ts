// Shared font loader for the 1080×1080 card routes (Satori / next-og).
// Brand type: IBM Plex Sans + IBM Plex Mono (latin-ext via full TTFs).
// Forces TTF (Satori can't read woff2) via an old User-Agent to Google Fonts.
//
// 'Plex Display' is IBM Plex Sans 700 registered under its own family name:
// card titles set only fontFamily (no fontWeight), and Satori then picks the
// single face registered for that family — bold headlines with zero per-style
// weight plumbing.

type FontWeight = 400 | 500 | 600 | 700
interface OgFont { name: string; data: ArrayBuffer; weight: FontWeight; style: 'normal' }

async function loadFont(family: string, weight: number): Promise<ArrayBuffer> {
  const css = await (
    await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; rv:1.9) Gecko/20100101 Firefox/3.5' },
    })
  ).text()
  const m = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/)
  if (!m) throw new Error(`font not found: ${family} ${weight}`)
  return (await fetch(m[1])).arrayBuffer()
}

let cache: Promise<OgFont[]> | null = null

export function getCardFonts(): Promise<OgFont[]> {
  return (cache ??= (async () => {
    const [display, s4, s5, s6, s7, m4, m5] = await Promise.all([
      loadFont('IBM Plex Sans', 700),
      loadFont('IBM Plex Sans', 400),
      loadFont('IBM Plex Sans', 500),
      loadFont('IBM Plex Sans', 600),
      loadFont('IBM Plex Sans', 700),
      loadFont('IBM Plex Mono', 400),
      loadFont('IBM Plex Mono', 500),
    ])
    return [
      { name: 'Plex Display', data: display, weight: 400, style: 'normal' },
      { name: 'IBM Plex Sans', data: s4, weight: 400, style: 'normal' },
      { name: 'IBM Plex Sans', data: s5, weight: 500, style: 'normal' },
      { name: 'IBM Plex Sans', data: s6, weight: 600, style: 'normal' },
      { name: 'IBM Plex Sans', data: s7, weight: 700, style: 'normal' },
      { name: 'IBM Plex Mono', data: m4, weight: 400, style: 'normal' },
      { name: 'IBM Plex Mono', data: m5, weight: 500, style: 'normal' },
    ] as OgFont[]
  })())
}
