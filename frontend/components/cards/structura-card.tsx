// 1080×1350 (4:5) structure carousel (post #3) — how each chamber is
// composed, party by party. The hero visual is the hemicycle colored in
// party wedges (left → right, largest party first), like the classic
// parliament seat charts.

export interface PartySeats {
  abbr: string
  name: string
  color: string
  seats: number
}

export interface StructuraCardData {
  slide: number
  /** parties sorted by seats desc — slide 2 senate, slide 3 camera */
  senate: PartySeats[]
  camera: PartySeats[]
}

const C = {
  bg: '#FFFFFF',
  text: '#171A1F',
  amberDark: '#B27A24',
  hair: '#E7E9EC',
  gray500: '#6E7480',
  gray400: '#9AA0AA',
  raised: '#F5F6F8',
}
const SERIF = 'Plex Display'   // IBM Plex Sans 700 (see og-fonts)
const SANS = 'IBM Plex Sans'
const MONO = 'IBM Plex Mono'

/** Dark text on light party colors (AUR yellow), white otherwise. */
function textOn(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
  return lum > 170 ? '#171A1F' : '#FFFFFF'
}

/** Hemicycle dots colored in angular party wedges (left → right). */
function partyArcDots(groups: { color: string; count: number }[]) {
  const total = groups.reduce((s, g) => s + g.count, 0)
  if (!total) return [] as { x: number; y: number; color: string }[]

  const cx = 476, cy = 302
  const innerR = 130, rowStep = 32, numRows = 6
  const radii: number[] = []
  for (let i = 0; i < numRows; i++) radii.push(innerR + i * rowStep)
  const sumR = radii.reduce((a, b) => a + b, 0)
  const seats = radii.map(r => Math.round((total * r) / sumR))
  seats[numRows - 1] += total - seats.reduce((a, b) => a + b, 0)

  // positions with their sweep angle (π = far left … 0 = far right)
  const pos: { x: number; y: number; angle: number; row: number }[] = []
  for (let row = 0; row < numRows; row++) {
    const r = radii[row], n = seats[row]
    for (let i = 0; i < n; i++) {
      const angle = n > 1 ? Math.PI * (1 - i / (n - 1)) : Math.PI / 2
      pos.push({ x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle), angle, row })
    }
  }
  // wedge fill: sweep left → right across all rows at once
  pos.sort((a, b) => b.angle - a.angle || a.row - b.row)

  const colors: string[] = []
  for (const g of groups) for (let i = 0; i < g.count; i++) colors.push(g.color)

  return pos.map((p, i) => ({ x: p.x, y: p.y, color: colors[i] ?? '#D8DBE0' }))
}

function Frame({ children, kicker }: { children: React.ReactNode; kicker: string }) {
  return (
    <div style={{ width: 1080, height: 1350, display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontFamily: SANS }}>
      {/* no logo header on IG post slides — the profile picture already shows it */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '36px 64px 22px' }}>
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 16, letterSpacing: 2.5, textTransform: 'uppercase', color: C.gray500 }}>{kicker}</div>
      </div>
      <div style={{ display: 'flex', height: 1, margin: '0 64px', background: C.hair }} />
      {children}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '18px 64px', borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: C.hair }}>
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 14, fontWeight: 500, color: '#171A1F' }}>@la.butoane</div>
        <div style={{ display: 'flex', fontFamily: MONO, fontSize: 12, color: C.gray500 }}>surse: senat.ro · cdep.ro</div>
      </div>
    </div>
  )
}

/** One chamber slide: wedge hemicycle + the party list with seat bars. */
function ChamberSlide({ title, parties, note }: { title: string; parties: PartySeats[]; note?: string }) {
  const total = parties.reduce((s, p) => s + p.seats, 0)
  const max = parties[0]?.seats ?? 1
  const dots = partyArcDots(parties.map(p => ({ color: p.color, count: p.seats })))
  const rowH = parties.length > 7 ? 44 : 50

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: '0 64px' }}>
      <div style={{ fontFamily: SERIF, fontSize: 58, lineHeight: 1.06 }}>{title}</div>
      <div style={{ display: 'flex', fontSize: 24, color: C.gray500, marginTop: 8 }}>
        {`${total} de mandate, după grupurile de azi`}
      </div>

      <div style={{ display: 'flex', width: '100%', height: 300, justifyContent: 'center', marginTop: 30 }}>
        <svg width={927} height={300} viewBox="0 0 952 308">
          {dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={6} fill={d.color} />
          ))}
        </svg>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 34 }}>
        {parties.map(p => (
          <div key={p.abbr} style={{ display: 'flex', alignItems: 'center', height: rowH }}>
            <div style={{ display: 'flex', width: 92, justifyContent: 'center', background: p.color, color: textOn(p.color), fontSize: 16, fontWeight: 700, padding: '5px 0', borderRadius: 4 }}>
              {p.abbr}
            </div>
            <div style={{ display: 'flex', flexGrow: 1, flexShrink: 1, flexBasis: 0, alignItems: 'center', margin: '0 18px' }}>
              <div style={{ display: 'flex', width: `${Math.round((p.seats / max) * 100)}%`, height: 13, borderRadius: 3, background: p.color }} />
            </div>
            <div style={{ display: 'flex', width: 56, justifyContent: 'flex-end', fontFamily: SERIF, fontSize: 27 }}>{String(p.seats)}</div>
          </div>
        ))}
      </div>

      {note && (
        <div style={{ display: 'flex', fontSize: 17, color: C.gray500, marginTop: 22 }}>{note}</div>
      )}
    </div>
  )
}

export function StructuraCard({ data }: { data: StructuraCardData }) {
  const senTotal = data.senate.reduce((s, p) => s + p.seats, 0)
  const camTotal = data.camera.reduce((s, p) => s + p.seats, 0)

  // ── Slide 1 — cover ───────────────────────────────────────────
  if (data.slide === 1) {
    const dots = partyArcDots(
      [...data.senate, ...data.camera]
        .reduce((acc, p) => {
          const hit = acc.find(a => a.abbr === p.abbr)
          if (hit) hit.seats += p.seats
          else acc.push({ ...p })
          return acc
        }, [] as PartySeats[])
        .sort((a, b) => b.seats - a.seats)
        .map(p => ({ color: p.color, count: p.seats })),
    )
    return (
      <Frame kicker="STRUCTURA PARLAMENTULUI · 1/4">
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: '0 64px' }}>
          <div style={{ fontFamily: SERIF, fontSize: 88, lineHeight: 1.05, letterSpacing: '-1px' }}>
            Cine stă la butoane?
          </div>
          <div style={{ display: 'flex', fontSize: 30, lineHeight: 1.45, color: C.gray500, marginTop: 26, maxWidth: 900 }}>
            {`${senTotal + camTotal} de mandate: ${senTotal} în Senat, ${camTotal} în Camera Deputaților.`}
          </div>
          <div style={{ display: 'flex', width: '100%', height: 320, justifyContent: 'center', marginTop: 46 }}>
            <svg width={927} height={300} viewBox="0 0 952 308">
              {dots.map((d, i) => (
                <circle key={i} cx={d.x} cy={d.y} r={6} fill={d.color} />
              ))}
            </svg>
          </div>
          <div style={{ display: 'flex', fontSize: 26, fontWeight: 600, color: C.amberDark, marginTop: 24 }}>
            Structura fiecărei camere, partid cu partid.
          </div>
        </div>
      </Frame>
    )
  }

  // ── Slide 2 — Senatul ─────────────────────────────────────────
  if (data.slide === 2) {
    return (
      <Frame kicker="STRUCTURA PARLAMENTULUI · 2/4">
        <ChamberSlide
          title="Senatul"
          parties={data.senate}
          note="IND = senatori fără apartenență la un grup (independenți)."
        />
      </Frame>
    )
  }

  // ── Slide 3 — Camera Deputaților ──────────────────────────────
  if (data.slide === 3) {
    return (
      <Frame kicker="STRUCTURA PARLAMENTULUI · 3/4">
        <ChamberSlide
          title="Camera Deputaților"
          parties={data.camera}
          note="MIN = grupul minorităților naționale. IND = deputați independenți."
        />
      </Frame>
    )
  }

  // ── Slide 4 — CTA ─────────────────────────────────────────────
  return (
    <Frame kicker="STRUCTURA PARLAMENTULUI · 4/4">
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: '0 64px' }}>
        <div style={{ fontFamily: SERIF, fontSize: 76, lineHeight: 1.06, letterSpacing: '-0.5px' }}>
          Mandatele sunt doar începutul.
        </div>
        <div style={{ display: 'flex', fontSize: 30, lineHeight: 1.5, color: C.gray500, marginTop: 28, maxWidth: 900 }}>
          Contează ce fac cu ele: fiecare vot, fiecare absență, fiecare deviere de la linia de partid. Pe LaButoane le vezi pe toate, pe fiecare parlamentar.
        </div>
        <div style={{ display: 'flex', fontSize: 28, fontWeight: 600, marginTop: 44 }}>
          Caută-ți județul și vezi cum votează aleșii tăi.
        </div>
        <div style={{ display: 'flex', fontSize: 24, color: C.gray500, marginTop: 10 }}>
          Site-ul: link în bio.
        </div>
      </div>
    </Frame>
  )
}
