interface Props { outcome: 'adoptat' | 'respins' | null | undefined }

export function OutcomeBadge({ outcome }: Props) {
  if (!outcome) return <span className="text-[11px] text-faint">—</span>
  const adopted = outcome === 'adoptat'
  return (
    <span
      className="inline-flex items-center text-[9px] uppercase font-bold tracking-[0.06em] px-[7px] py-[1px] rounded-[3px]"
      style={
        adopted
          ? { backgroundColor: '#eef7f2', color: 'var(--color-for)' }
          : { backgroundColor: '#fdf0ef', color: 'var(--color-against)' }
      }
    >
      {adopted ? 'Adoptat' : 'Respins'}
    </span>
  )
}
