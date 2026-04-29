interface Seg { value: number; color: string }

interface Props {
  segments: Seg[]
  size?: number
  ring?: number
  centerLabel?: string
  centerSub?: string
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, R: number, ri: number, a1: number, a2: number): string {
  const gap = 2
  const sa = a1 + gap
  const ea = a2 - gap
  if (ea - sa <= 0) return ''
  const large = ea - sa > 180 ? 1 : 0
  const s1 = polar(cx, cy, R,  sa)
  const e1 = polar(cx, cy, R,  ea)
  const s2 = polar(cx, cy, ri, ea)
  const e2 = polar(cx, cy, ri, sa)
  const f = (n: number) => n.toFixed(2)
  return [
    `M ${f(s1.x)} ${f(s1.y)}`,
    `A ${R} ${R} 0 ${large} 1 ${f(e1.x)} ${f(e1.y)}`,
    `L ${f(s2.x)} ${f(s2.y)}`,
    `A ${ri} ${ri} 0 ${large} 0 ${f(e2.x)} ${f(e2.y)}`,
    'Z',
  ].join(' ')
}

export function DonutChart({ segments, size = 140, ring = 26, centerLabel, centerSub }: Props) {
  const total = segments.reduce((s, r) => s + r.value, 0)
  if (!total) return null

  const cx = size / 2
  const cy = size / 2
  const R  = size / 2 - 2
  const ri = R - ring

  let cursor = 0
  const arcs = segments
    .filter(s => s.value > 0)
    .map(s => {
      const start = cursor
      const end   = start + (s.value / total) * 360
      cursor = end
      return { color: s.color, start, end }
    })

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {arcs.map((a, i) => {
        const d = arcPath(cx, cy, R, ri, a.start, a.end)
        return d ? <path key={i} d={d} fill={a.color} /> : null
      })}
      {centerLabel && (
        <text
          x={cx} y={centerSub ? cy - size * 0.08 : cy}
          textAnchor="middle" dominantBaseline="middle"
          fill="var(--text)" fontSize={size * 0.2} fontWeight="600"
          fontFamily="system-ui, sans-serif"
        >
          {centerLabel}
        </text>
      )}
      {centerSub && (
        <text
          x={cx} y={cy + size * 0.12}
          textAnchor="middle" dominantBaseline="middle"
          fill="var(--muted)" fontSize={size * 0.11}
          fontFamily="system-ui, sans-serif"
        >
          {centerSub}
        </text>
      )}
    </svg>
  )
}
