interface Props { outcome: 'adoptat' | 'respins' | null | undefined }

export function OutcomeBadge({ outcome }: Props) {
  if (!outcome) return <span className="text-xs text-[#999]">—</span>
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-white ${
        outcome === 'adoptat' ? 'bg-adoptat' : 'bg-respins'
      }`}
    >
      {outcome === 'adoptat' ? 'Adoptat' : 'Respins'}
    </span>
  )
}
