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
          className="text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded px-1.5 py-px whitespace-nowrap"
        >
          {l.short}
        </span>
      ))}
    </>
  )
}
