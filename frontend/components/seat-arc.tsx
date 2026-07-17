'use client'

interface Props {
  forCount: number
  againstCount: number
  abstentionCount: number
  notVotedCount?: number
  /** True absentees (chamber seats − participants). Drawn as very light grey
   *  dots so the arc represents the FULL chamber, matching the shareable vote
   *  card and this component's own legend. Omit/0 on joint sessions. */
  absentCount?: number
  outcome: 'adoptat' | 'respins' | null
  /** Internal SVG coordinate width. The SVG is responsive and fills its
   *  container regardless — this only sets the drawing resolution. Default 400 */
  width?: number
}

/**
 * Semicircular parliament seating diagram.
 * Responsive: scales to fill its container via viewBox (no fixed pixel width).
 * Seats arranged in concentric arcs, coloured by vote choice.
 * Order: for (green) → against (red) → abstention (purple) → not_voted (darker grey)
 *        → absent (lightest grey)
 */
export function SeatArc({
  forCount,
  againstCount,
  abstentionCount,
  notVotedCount = 0,
  absentCount = 0,
  outcome,
  width = 400,
}: Props) {
  const h = Math.round(width * 0.5) + 28
  const cx = width / 2
  const cy = Math.round(width * 0.46)
  const rStart = Math.round(width * 0.18)
  const rowGap = Math.round(width * 0.048)

  const order: string[] = [
    ...Array(forCount).fill('var(--color-for)'),
    ...Array(againstCount).fill('var(--color-against)'),
    ...Array(abstentionCount).fill('var(--color-abstention)'),
    ...Array(notVotedCount).fill('var(--muted)'),
    ...Array(Math.max(0, absentCount)).fill('var(--color-absent)'),
  ]

  // Rows scale with the vote size: 4 rows fit the Senate (~136), Camera
  // votes (~330) need more. Seats are split across rows proportional to
  // radius so every vote is drawn — nothing gets silently truncated.
  const total = order.length
  const numRows = total <= 140 ? 4 : total <= 240 ? 5 : 6
  const dotR = width * (total <= 140 ? 0.0135 : total <= 240 ? 0.011 : 0.009)
  const radii = Array.from({ length: numRows }, (_, i) => rStart + i * rowGap)
  const sumR = radii.reduce((a, b) => a + b, 0)
  const seats = radii.map(r => Math.round((total * r) / sumR))
  seats[numRows - 1] += total - seats.reduce((a, b) => a + b, 0) // fix rounding drift

  const dots: { x: number; y: number; fill: string }[] = []
  let idx = 0

  seats.forEach((count, ri) => {
    const r = radii[ri]
    for (let i = 0; i < count && idx < order.length; i++, idx++) {
      const angle = Math.PI * (i / Math.max(count - 1, 1))
      // round to 2dp: raw Math.sin/cos differ in the last ulp between
      // server and client, causing hydration attribute mismatches
      dots.push({
        x: Math.round((cx - r * Math.cos(angle)) * 100) / 100,
        y: Math.round((cy - r * Math.sin(angle)) * 100) / 100,
        fill: order[idx],
      })
    }
  })

  const heroColor = outcome === 'adoptat' ? 'var(--color-for)' : outcome === 'respins' ? 'var(--color-against)' : 'var(--muted)'
  const heroSymbol = outcome === 'adoptat' ? '✓' : outcome === 'respins' ? '✗' : '—'

  return (
    <svg
      viewBox={`0 0 ${width} ${h}`}
      width="100%"
      style={{ maxWidth: width, height: 'auto', overflow: 'visible' }}
      role="img"
      aria-label="Distribuția voturilor în plen"
    >
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={dotR} fill={d.fill} opacity={0.9} />
      ))}
      <text
        x={cx}
        y={cy + 2}
        textAnchor="middle"
        fill={heroColor}
        fontSize={Math.round(width * 0.065)}
        fontWeight={900}
        fontFamily="system-ui, sans-serif"
      >
        {heroSymbol}
      </text>
      <text
        x={cx}
        y={cy + Math.round(width * 0.058)}
        textAnchor="middle"
        fill="var(--muted)"
        fontSize={Math.round(width * 0.026)}
        letterSpacing={2}
        fontFamily="system-ui, sans-serif"
      >
        {outcome?.toUpperCase() ?? ''}
      </text>
    </svg>
  )
}
