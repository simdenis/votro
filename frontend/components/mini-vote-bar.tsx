interface Props {
  forCount: number | null
  againstCount: number | null
  abstentionCount: number | null
}

export function MiniVoteBar({ forCount, againstCount, abstentionCount }: Props) {
  const f = forCount ?? 0
  const a = againstCount ?? 0
  const b = abstentionCount ?? 0
  const total = f + a + b
  if (total === 0) return <div className="h-2 w-24 bg-rim rounded-full" />

  const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`

  return (
    <div className="flex h-2 w-24 rounded-full overflow-hidden">
      {f > 0 && <div className="bg-adoptat" style={{ width: pct(f) }} />}
      {a > 0 && <div className="bg-respins" style={{ width: pct(a) }} />}
      {b > 0 && <div className="bg-[#5050a0]" style={{ width: pct(b) }} />}
    </div>
  )
}
