'use client'

interface Props {
  /** 0–100 loyalty percentage (100 - deviation_pct) */
  loyaltyPct: number
  /** SVG width. Height is ~75% of width. Default 128 */
  size?: number
}

/**
 * Arc gauge showing party loyalty percentage.
 * Green ≥ 90 · Amber 70–89 · Red < 70
 */
export function LoyaltyMeter({ loyaltyPct, size = 128 }: Props) {
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.38
  const strokeW = size * 0.075
  const height = Math.round(size * 0.75)

  // Arc runs 135° → 405° (270° sweep, opening at bottom-left to bottom-right)
  const startAngle = (135 * Math.PI) / 180
  const sweep = (270 * Math.PI) / 180

  const toXY = (angle: number) => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  })

  const start = toXY(startAngle)
  const trackEnd = toXY(startAngle + sweep)

  const filledAngle = startAngle + (loyaltyPct / 100) * sweep
  const filled = toXY(filledAngle)
  const largeArcFilled = loyaltyPct > 50 ? 1 : 0

  const color =
    loyaltyPct >= 90 ? '#16a34a' : loyaltyPct >= 70 ? '#d97706' : '#dc2626'

  const fmt = (n: number) => n.toFixed(2)

  return (
    <svg width={size} height={height} style={{ overflow: 'visible' }}>
      {/* Track */}
      <path
        d={`M ${fmt(start.x)} ${fmt(start.y)} A ${r} ${r} 0 1 1 ${fmt(trackEnd.x)} ${fmt(trackEnd.y)}`}
        fill="none"
        stroke="var(--raised)"
        strokeWidth={strokeW}
        strokeLinecap="round"
      />
      {/* Filled arc */}
      {loyaltyPct > 0 && (
        <path
          d={`M ${fmt(start.x)} ${fmt(start.y)} A ${r} ${r} 0 ${largeArcFilled} 1 ${fmt(filled.x)} ${fmt(filled.y)}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
          strokeLinecap="round"
        />
      )}
      {/* Value */}
      <text
        x={cx}
        y={cy + size * 0.04}
        textAnchor="middle"
        fill="var(--text)"
        fontSize={size * 0.18}
        fontWeight={800}
        fontFamily="system-ui, sans-serif"
      >
        {loyaltyPct}%
      </text>
      <text
        x={cx}
        y={cy + size * 0.18}
        textAnchor="middle"
        fill="var(--muted)"
        fontSize={size * 0.085}
        letterSpacing={1.5}
        fontFamily="system-ui, sans-serif"
      >
        LOIALITATE
      </text>
    </svg>
  )
}
