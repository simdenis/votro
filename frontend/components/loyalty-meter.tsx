'use client'

interface Props {
  /** 0–100: votes cast WITH the party line / votes EXPRESSED (see lib/utils loyaltyParts).
      Presence is a separate number — this gauge deliberately excludes absences. */
  loyaltyPct: number
  /** SVG width. Height is ~75% of width. Default 128 */
  size?: number
}

/**
 * Arc gauge showing party loyalty over votes cast.
 * Deviation is rare in RO party-line voting, so loyalty clusters high;
 * bands flag the exceptions: Green ≥ 90 · Amber 80–89 · Red < 80
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
  // large-arc kicks in once the filled sweep exceeds 180° (i.e. 180/270 ≈ 66.7%)
  const largeArcFilled = (loyaltyPct / 100) * 270 > 180 ? 1 : 0

  const color =
    loyaltyPct >= 90 ? 'var(--color-for)' : loyaltyPct >= 80 ? 'var(--color-deviation)' : 'var(--color-against)'

  const fmt = (n: number) => n.toFixed(2)

  return (
    <svg width={size} height={height} style={{ overflow: 'visible' }}>
      <title>Voturi aliniate cu partidul, din voturile exprimate. Prezența e o metrică separată.</title>
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
        fontSize={size * 0.07}
        letterSpacing={0.5}
        fontFamily="system-ui, sans-serif"
      >
        LOIALITATE
      </text>
    </svg>
  )
}
