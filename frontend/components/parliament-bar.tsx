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
      <div className="flex h-[34px] rounded-[7px] overflow-hidden gap-[2px]">
        {parties.map(p => {
          const share = sum > 0 ? p.senator_count / sum : 0
          return (
            <div
              key={p.abbreviation}
              title={`${p.abbreviation}: ${p.senator_count}`}
              className="flex items-center justify-center text-[12.5px] font-bold text-white overflow-hidden"
              style={{ flex: p.senator_count, backgroundColor: p.color }}
            >
              {share > 0.05 && p.abbreviation}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
        {parties.map(p => (
          <span key={p.abbreviation} className="flex items-center gap-1.5 text-[12.5px] text-muted">
            <span
              className="inline-block w-[9px] h-[9px] rounded-[2px] flex-shrink-0"
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
