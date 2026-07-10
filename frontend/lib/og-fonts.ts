// Shared font loader for the card routes (Satori / next-og).
// Fonts are VENDORED in assets/fonts and bundled with each edge function via
// import.meta.url — no Google Fonts fetch at runtime. (The old runtime fetch
// intermittently died with 'Network connection lost' on cold edge isolates
// and 500'd whole card routes.)
//
// 'Plex Display' is IBM Plex Sans 700 registered under its own family name:
// card titles set only fontFamily (no fontWeight), and Satori then picks the
// single face registered for that family — bold headlines with zero per-style
// weight plumbing.

type FontWeight = 400 | 500 | 600 | 700
interface OgFont { name: string; data: ArrayBuffer; weight: FontWeight; style: 'normal' }

const sans400 = fetch(new URL('../assets/fonts/plex-sans-400.ttf', import.meta.url)).then(r => r.arrayBuffer())
const sans500 = fetch(new URL('../assets/fonts/plex-sans-500.ttf', import.meta.url)).then(r => r.arrayBuffer())
const sans600 = fetch(new URL('../assets/fonts/plex-sans-600.ttf', import.meta.url)).then(r => r.arrayBuffer())
const sans700 = fetch(new URL('../assets/fonts/plex-sans-700.ttf', import.meta.url)).then(r => r.arrayBuffer())
const mono400 = fetch(new URL('../assets/fonts/plex-mono-400.ttf', import.meta.url)).then(r => r.arrayBuffer())
const mono500 = fetch(new URL('../assets/fonts/plex-mono-500.ttf', import.meta.url)).then(r => r.arrayBuffer())

let cache: Promise<OgFont[]> | null = null

export function getCardFonts(): Promise<OgFont[]> {
  return (cache ??= (async () => {
    const [s4, s5, s6, s7, m4, m5] = await Promise.all([sans400, sans500, sans600, sans700, mono400, mono500])
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
