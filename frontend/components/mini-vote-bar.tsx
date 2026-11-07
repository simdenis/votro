interface Props {
  forCount: number | null
  againstCount: number | null
  abstentionCount: number | null
}

/** Vote split as numbers (pentru · împotrivă · abțineri), each in its vote colour. */
export function MiniVoteBar({ forCount, againstCount, abstentionCount }: Props) {
  const f = forCount ?? 0
  const a = againstCount ?? 0
  const b = abstentionCount ?? 0
  if (f + a + b === 0) return <span className="text-[11px] text-faint">—</span>
  return (
    <span className="font-mono text-[12px] tabular-nums whitespace-nowrap" aria-label={`${f} pentru, ${a} împotrivă, ${b} abțineri`}>
      <span style={{ color: 'var(--color-for-dark)' }}>{f}</span>
      <span className="text-faint"> · </span>
      <span style={{ color: 'var(--color-against-dark)' }}>{a}</span>
      <span className="text-faint"> · </span>
      <span style={{ color: 'var(--color-abstention-dark)' }}>{b}</span>
    </span>
  )
}
