import { detectBaseLaws } from '@/lib/base-laws'

export function BaseLawBadges({ title }: { title: string }) {
  const laws = detectBaseLaws(title)
  if (!laws.length) return null
  return (
    <>
      {laws.map(l => (
        <span
          key={l.code}
          title={l.name}
          className="text-[10px] font-semibold bg-white text-[var(--info-dark)] border border-[var(--color-absent)] rounded px-1.5 py-px whitespace-nowrap"
        >
          {l.short}
        </span>
      ))}
    </>
  )
}
