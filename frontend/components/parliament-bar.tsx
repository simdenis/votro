interface Party {
  abbreviation: string
  color: string
  senator_count: number
}

interface Props {
  parties: Party[]
  total?: number
}

export function ParliamentBar({ parties, total }: Props) {
  const sum = total ?? parties.reduce((s, p) => s + p.senator_count, 0)

  return (
    <div>
      {/* Stacked bar */}
      <div className="flex h-3 rounded overflow-hidden gap-0.5">
        {parties.map(p => (
          <div
            key={p.abbreviation}
            title={`${p.abbreviation}: ${p.senator_count}`}
            style={{
              flex: p.senator_count,
              backgroundColor: p.color,
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
        {parties.map(p => (
          <span key={p.abbreviation} className="flex items-center gap-1.5 text-xs text-muted">
            <span
              className="inline-block w-2 h-2 rounded-sm flex-shrink-0"
              style={{ backgroundColor: p.color }}
            />
            {p.abbreviation}
            <strong className="text-foreground tabular-nums">{p.senator_count}</strong>
          </span>
        ))}
      </div>
    </div>
  )
}
