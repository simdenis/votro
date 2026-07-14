export interface TrendSeries { name: string; color: string; points: (number | null)[] }

interface Props {
  months: string[]          // x labels, e.g. "feb '25"
  series: TrendSeries[]      // one line per chamber
}

// Fixed 0–100% y-axis (attendance is a rate). SVG in a viewBox so it scales;
// marks carry native-title tooltips for the hover layer, lines are direct-
// labeled at their end so identity never rests on color alone.
const W = 720, H = 260
const PAD = { t: 16, r: 54, b: 30, l: 34 }
const plotW = W - PAD.l - PAD.r
const plotH = H - PAD.t - PAD.b

export function AttendanceTrend({ months, series }: Props) {
  const n = months.length
  const x = (i: number) => PAD.l + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW)
  const y = (v: number) => PAD.t + (1 - v / 100) * plotH
  const grid = [0, 25, 50, 75, 100]
  // label every ~6th month so the axis doesn't crowd
  const step = Math.max(1, Math.round(n / 6))

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px]" role="img"
           aria-label="Prezența medie în plen, lună de lună, pe cameră">
        {/* recessive y grid + labels */}
        {grid.map(g => (
          <g key={g}>
            <line x1={PAD.l} y1={y(g)} x2={W - PAD.r} y2={y(g)} stroke="var(--rim)" strokeWidth="1" />
            <text x={PAD.l - 6} y={y(g) + 3} textAnchor="end" fontSize="10" fill="var(--muted)">{g}%</text>
          </g>
        ))}
        {/* x labels */}
        {months.map((m, i) => (i % step === 0 || i === n - 1) && (
          <text key={i} x={x(i)} y={H - PAD.b + 16} textAnchor="middle" fontSize="10" fill="var(--muted)">{m}</text>
        ))}
        {/* series */}
        {series.map(s => {
          const pts = s.points.map((v, i) => (v == null ? null : [x(i), y(v)] as const))
          const d = pts.filter(Boolean).map((p, i) => `${i === 0 ? 'M' : 'L'} ${p![0].toFixed(1)} ${p![1].toFixed(1)}`).join(' ')
          const last = [...pts].reverse().find(Boolean)!
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {pts.map((p, i) => p && (
                <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill={s.color} stroke="var(--surface)" strokeWidth="1.5">
                  <title>{`${s.name} · ${months[i]}: ${s.points[i]}% prezență`}</title>
                </circle>
              ))}
              <text x={last[0] + 8} y={last[1] + 3} fontSize="11" fontWeight="600" fill={s.color}>{s.name}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
