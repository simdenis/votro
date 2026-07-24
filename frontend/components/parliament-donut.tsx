interface Party {
  abbreviation: string
  color: string
  senator_count: number
}

interface Props {
  parties: Party[]
  total?: number
}

/** Parliament composition as a donut, sized for the homepage hero (right of the
 *  search box). Segments via stroke-dasharray on a single ring; total in the
 *  centre; compact legend beneath. */
export function ParliamentDonut({ parties, total }: Props) {
  const sum = total ?? parties.reduce((s, p) => s + p.senator_count, 0)
  const R = 42
  const C = 2 * Math.PI * R

  let offset = 0
  const segments = parties.map(p => {
    const frac = sum > 0 ? p.senator_count / sum : 0
    const len = frac * C
    const seg = { ...p, len, dashOffset: -offset }
    offset += len
    return seg
  })

  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.14em] text-faint mb-3">Componența Parlamentului</p>

      <div className="flex items-center gap-4">
        <svg viewBox="0 0 120 120" className="w-[116px] h-[116px] flex-shrink-0" role="img" aria-label={`Parlament: ${sum} parlamentari`}>
          <circle cx="60" cy="60" r={R} fill="none" stroke="var(--rim)" strokeWidth="15" />
          {segments.map(s => (
            <circle
              key={s.abbreviation}
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth="15"
              strokeDasharray={`${s.len} ${C - s.len}`}
              strokeDashoffset={s.dashOffset}
              transform="rotate(-90 60 60)"
            >
              <title>{`${s.abbreviation}: ${s.senator_count}`}</title>
            </circle>
          ))}
          <text x="60" y="56" textAnchor="middle" className="fill-foreground" style={{ fontSize: 22, fontWeight: 700 }}>{sum}</text>
          <text x="60" y="72" textAnchor="middle" className="fill-muted" style={{ fontSize: 8.5, letterSpacing: 0.5 }}>PARLAMENTARI</text>
        </svg>

        <div className="grid grid-cols-1 gap-x-4 gap-y-1 min-w-0">
          {parties.map(p => (
            <span key={p.abbreviation} className="flex items-center gap-1.5 text-[12px] text-muted">
              <span className="inline-block w-[9px] h-[9px] rounded-[2px] flex-shrink-0" style={{ backgroundColor: p.color }} />
              <span className="truncate">{p.abbreviation}</span>
              <strong className="text-foreground tabular-nums ml-auto">{p.senator_count}</strong>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
