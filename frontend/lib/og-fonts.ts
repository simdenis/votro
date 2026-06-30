// Shared font loader for the 1080×1080 card routes (Satori / next-og).
// Forces TTF (Satori can't read woff2) via an old User-Agent to Google Fonts.

type FontWeight = 400 | 500 | 600
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
    const [serif, s4, s5, s6] = await Promise.all([
      loadFont('DM Serif Display', 400),
      loadFont('DM Sans', 400),
      loadFont('DM Sans', 500),
      loadFont('DM Sans', 600),
    ])
    return [
      { name: 'DM Serif Display', data: serif, weight: 400, style: 'normal' },
      { name: 'DM Sans', data: s4, weight: 400, style: 'normal' },
      { name: 'DM Sans', data: s5, weight: 500, style: 'normal' },
      { name: 'DM Sans', data: s6, weight: 600, style: 'normal' },
    ]
  })())
}
