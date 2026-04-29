'use client'

interface Props {
  forCount: number
  againstCount: number
  abstentionCount: number
  notVotedCount?: number
  outcome: 'adoptat' | 'respins' | null
  /** SVG width. Height is automatically ~half + margin. Default 460 */
  width?: number
}

/**
 * Semicircular parliament seating diagram.
 * Seats are arranged in 4 concentric arcs, coloured by vote choice.
 * Order: for (green) → against (red) → abstention (purple) → not_voted (grey)
 */
export function SeatArc({
  forCount,
  againstCount,
  abstentionCount,
  notVotedCount = 0,
  outcome,
  width = 460,
}: Props) {
  const h = Math.round(width * 0.5) + 30
  const cx = width / 2
  const cy = Math.round(width * 0.46)
  const rStart = Math.round(width * 0.18)
  const rowGap = Math.round(width * 0.048)
  const dotR = Math.round(width * 0.013)

  const order: string[] = [
    ...Array(forCount).fill('#22c55e'),
    ...Array(againstCount).fill('#ef4444'),
    ...Array(abstentionCount).fill('#8888cc'),
    ...Array(notVotedCount).fill('#d1d5db'),
  ]

  const rowCounts = [36, 38, 34, 28]
  const dots: { x: number; y: number; fill: string }[] = []
  let idx = 0

  rowCounts.forEach((count, ri) => {
    const r = rStart + ri * rowGap
    for (let i = 0; i < count && idx < order.length; i++, idx++) {
      const angle = Math.PI * (i / Math.max(count - 1, 1))
      dots.push({
        x: cx - r * Math.cos(angle),
        y: cy - r * Math.sin(angle),
        fill: order[idx],
      })
    }
  })

  const heroColor = outcome === 'adoptat' ? '#16a34a' : outcome === 'respins' ? '#dc2626' : 'var(--muted)'
  const heroSymbol = outcome === 'adoptat' ? '✓' : outcome === 'respins' ? '✗' : '—'

  return (
    <svg width={width} height={h} style={{ overflow: 'visible' }}>
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
        y={cy + Math.round(width * 0.055)}
        textAnchor="middle"
        fill="var(--muted)"
        fontSize={Math.round(width * 0.024)}
        letterSpacing={2}
        fontFamily="system-ui, sans-serif"
      >
        {outcome?.toUpperCase() ?? ''}
      </text>
    </svg>
  )
}
