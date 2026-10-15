// 1080×1350 (4:5) tacit-adoption card — "nobody voted this law".
// The hero visual is the parliament arc rendered entirely in absent-gray:
// a plenary vote that never happened. Amber = the brand's tacit/abstain hue.
// v2: the explanation is the second thing read (38px, was 24); the chip moved
// down to sit with the law it labels.

import { computeArcDots } from './vote-card'
import { C, F, T, CardHeader, CardFooter, StatusChip, clip } from './kit'

export interface TacitCardData {
  lawCode: string
  lawTitle: string
  chamber: 'SENAT' | 'CAMERA DEPUTAȚILOR'
  year: number
  /** chamber seat count — how many people didn't vote */
  seats: number
  /** e.g. "mai departe la Cameră · 12 mai 2026" or null */
  dateLine: string | null
}

/** Shrink the title as it grows so it always fits. */
function titleFont(len: number): number {
  if (len <= 90) return 34
  if (len <= 160) return 30
  return 28
}

export function TacitCard({ data }: { data: TacitCardData }) {
  // every seat absent — the whole arc is gray
  const dots = computeArcDots(0, 0, 0, 0, data.seats)
  const where = data.chamber === 'SENAT' ? 'Senat' : 'Camera Deputaților'
  const title = clip(data.lawTitle, 200)

  return (
    <div style={{ width: 1080, height: 1350, display: 'flex', flexDirection: 'column', background: C.bg, color: C.ink, fontFamily: F.sans }}>
      <CardHeader kicker={`Adoptare tacită · ${where}`} right={`${data.year}`} />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '44px 64px 36px' }}>
        <div style={{ fontFamily: F.display, fontSize: 70, lineHeight: 1.04, letterSpacing: '-0.5px', color: C.ink, flexShrink: 0 }}>
          Nimeni nu a votat această lege.
        </div>
        <div style={{ fontSize: T.lead, lineHeight: 1.36, color: C.slate, marginTop: 24, flexShrink: 0 }}>
          {`Termenul constituțional a expirat fără vot în ${where}, așa că legea a fost considerată adoptată (art. 75).`}
        </div>

        {/* The vote that never happened — a full arc of absent-gray seats */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 34, flexShrink: 0 }}>
          <svg width={840} height={272} viewBox="0 0 952 308">
            {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={6} fill={C.absent} />)}
          </svg>
          <div style={{ display: 'flex', fontFamily: F.mono, fontSize: T.fine, letterSpacing: 2, color: C.muted, marginTop: 10 }}>
            {`${data.seats} DE MANDATE · 0 VOTURI`}
          </div>
        </div>

        <div style={{ display: 'flex', flexGrow: 1, minHeight: 24 }} />

        {/* The law itself, labelled */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            <StatusChip label="Adoptată tacit" tone="tacit" />
            {data.dateLine ? <div style={{ display: 'flex', fontSize: T.small, color: C.slate }}>{data.dateLine}</div> : null}
          </div>
          <div style={{ display: 'flex', fontFamily: F.mono, fontSize: T.small, fontWeight: 500, letterSpacing: 2, color: C.ink, marginTop: 8 }}>{data.lawCode}</div>
          <div style={{ fontSize: titleFont(title.length), lineHeight: 1.32, color: C.ink }}>{title}</div>
        </div>
      </div>

      <CardFooter />
    </div>
  )
}
