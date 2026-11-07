interface Props { outcome: 'adoptat' | 'respins' | null | undefined }

/** Vote result as plain coloured text (no chip). */
export function OutcomeBadge({ outcome }: Props) {
  if (!outcome) return <span className="text-[11px] text-faint">—</span>
  const adopted = outcome === 'adoptat'
  return (
    <span className="text-[12.5px] font-medium" style={{ color: adopted ? 'var(--color-for-dark)' : 'var(--color-against-dark)' }}>
      {adopted ? 'Adoptat' : 'Respins'}
    </span>
  )
}
