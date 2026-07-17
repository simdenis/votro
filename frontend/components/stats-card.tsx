interface Props {
  value: string | number
  label: React.ReactNode
  sub?: React.ReactNode
  accent?: string
}

export function StatsCard({ value, label, sub, accent }: Props) {
  return (
    <div
      className="bg-surface border border-rim rounded-lg p-5"
      style={accent ? { borderTopColor: accent, borderTopWidth: '3px' } : undefined}
    >
      {/* key figure: bold + larger so it reads as the primary element. Kept in
          --foreground (max contrast) — accent colors like PNL yellow / absence
          coral would be unreadable as text; the accent lives on the top border. */}
      <div className="text-[34px] font-bold text-foreground tabular-nums leading-none mb-1.5 truncate">
        {value}
      </div>
      <div className="text-sm text-muted">{label}</div>
      {sub && <div className="mt-2">{sub}</div>}
    </div>
  )
}
