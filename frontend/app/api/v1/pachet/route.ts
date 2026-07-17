import { json, cleanCode, sbJson, nominalVoteRows, toCsv } from '@/lib/api-v1'

// GET /api/v1/pachet?code=L230/2025 → ZIP: the law's shareable cards (the same
// slides the Instagram carousel uses — summary → tacit/chamber votes →
// deviations) + a CSV with how each parliamentarian voted.

interface LawStatus {
  law_id: string
  code: string
  presidential_status: string | null
  senate_vote_id: string | null
  senate_vote_date: string | null
  camera_vote_id: string | null
  camera_vote_date: string | null
}

// ── minimal ZIP writer (stored entries, no compression) ─────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function buildZip(entries: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder()
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const { name, data } of entries) {
    const nameBytes = enc.encode(name)
    const crc = crc32(data)
    const local = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)          // local file header
    lv.setUint16(4, 20, true)                  // version needed
    lv.setUint16(6, 0x0800, true)              // UTF-8 names
    lv.setUint16(8, 0, true)                   // stored
    lv.setUint32(14, crc, true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, data.length, true)
    lv.setUint16(26, nameBytes.length, true)
    local.set(nameBytes, 30)
    chunks.push(local, data)

    const cen = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(cen.buffer)
    cv.setUint32(0, 0x02014b50, true)          // central directory header
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, data.length, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint32(42, offset, true)
    cen.set(nameBytes, 46)
    central.push(cen)
    offset += local.length + data.length
  }

  const cdSize = central.reduce((a, c) => a + c.length, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, cdSize, true)
  ev.setUint32(16, offset, true)

  const out = new Uint8Array(offset + cdSize + 22)
  let pos = 0
  for (const c of [...chunks, ...central, eocd]) { out.set(c, pos); pos += c.length }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = cleanCode(url.searchParams.get('code'))
  if (!code) return json({ error: 'Parametrul „code” e obligatoriu (ex. L230/2025).' }, 400)

  let law: LawStatus | undefined
  try {
    law = (await sbJson<LawStatus[]>(`law_status?code=eq.${encodeURIComponent(code)}&limit=1`))[0]
  } catch {
    return json({ error: 'Sursa de date e indisponibilă momentan.' }, 502)
  }
  if (!law) return json({ error: 'Legea nu a fost găsită.' }, 404)

  // Same slide order as the Instagram carousel (scraper/instagram_poster.py):
  // summary → tacit chamber(s) → chamber votes chronologically → deviations.
  const slides: { name: string; path: string }[] = [
    { name: 'rezumat', path: `/api/og/summarycard?id=${law.law_id}` },
  ]
  const passed = Boolean(law.presidential_status)
  const chamberRo = (k: string) => (k === 'senate' ? 'senat' : 'camera-deputatilor')
  for (const [key, voteField] of [['senate', 'senate_vote_id'], ['camera', 'camera_vote_id']] as const) {
    if (passed && !law[voteField]) {
      slides.push({ name: `tacit-${chamberRo(key)}`, path: `/api/og/tacitcard?id=${law.law_id}&chamber=${key}` })
    }
  }
  const chambers: [string, string, string][] = []
  if (law.senate_vote_id) chambers.push([law.senate_vote_date ?? '', 'senate', law.senate_vote_id])
  if (law.camera_vote_id) chambers.push([law.camera_vote_date ?? '', 'camera', law.camera_vote_id])
  chambers.sort()
  for (const [, key] of chambers) {
    slides.push({ name: `vot-${chamberRo(key)}`, path: `/api/og/lawcard?id=${law.law_id}&chamber=${key}` })
  }

  // Deviation slide — the chamber vote where most people broke the party line.
  let devVote: string | null = null
  let devCount = 0
  try {
    for (const [, , vid] of chambers) {
      const n = (await sbJson<{ vote_id: string }[]>(
        `politician_votes?select=vote_id&vote_id=eq.${vid}&party_line_deviation=eq.true&limit=1000`,
      )).length
      if (n > devCount) { devVote = vid; devCount = n }
    }
  } catch { /* skip the deviation slide */ }
  if (devVote) slides.push({ name: 'devieri', path: `/api/og/deviationcard?vote=${devVote}` })

  // Fetch the card PNGs from our own og routes + the nominal CSV, in parallel.
  const origin = url.origin
  let images: (Uint8Array | null)[]
  let csvRows: Record<string, unknown>[]
  try {
    ;[images, csvRows] = await Promise.all([
      Promise.all(slides.map(async s => {
        const r = await fetch(`${origin}${s.path}`, { next: { revalidate: 3600 } })
        return r.ok ? new Uint8Array(await r.arrayBuffer()) : null
      })),
      nominalVoteRows(code),
    ])
  } catch {
    return json({ error: 'Nu am putut genera pachetul. Încearcă din nou.' }, 502)
  }

  const slug = code.replace(/[^\w]+/g, '-')
  const entries: { name: string; data: Uint8Array }[] = []
  images.forEach((img, i) => {
    if (img) entries.push({ name: `${String(i + 1).padStart(2, '0')}-${slides[i].name}.png`, data: img })
  })
  if (csvRows.length) entries.push({ name: `vot-nominal-${slug}.csv`, data: new TextEncoder().encode(toCsv(csvRows)) })
  if (!entries.length) return json({ error: 'Nu există carduri pentru această lege.' }, 404)

  const zip = buildZip(entries)
  return new Response(zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="labutoane-${slug}.zip"`,
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
