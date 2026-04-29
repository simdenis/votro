interface Props {
  value: string | number
  label: string
  sub?: React.ReactNode
  accent?: string
}

export function StatsCard({ value, label, sub, accent }: Props) {
  return (
    <div
      className="bg-surface border border-rim rounded-lg p-5"
      style={accent ? { borderTopColor: accent, borderTopWidth: '3px' } : undefined}
    >
      <div className="text-3xl font-semibold text-foreground tabular-nums leading-none mb-1 truncate">
        {value}
      </div>
      <div className="text-sm text-muted">{label}</div>
      {sub && <div className="mt-2">{sub}</div>}
    </div>
  )
}
