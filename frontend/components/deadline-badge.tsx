import { countNoun } from '@/lib/utils'

/** Days until a tacit-adoption deadline expires (end of day, Romania time). */
export function daysLeft(deadline: string): number {
  const ms = new Date(deadline + 'T23:59:59+03:00').getTime() - Date.now()
  return Math.ceil(ms / 86_400_000)
}

export function DeadlineBadge({ deadline, size = 'sm' }: { deadline: string; size?: 'sm' | 'lg' }) {
  const d = daysLeft(deadline)
  const cls = size === 'lg'
    ? 'inline-flex text-[15px] font-bold uppercase tracking-wide rounded-lg px-3.5 py-1.5'
    : 'inline-flex text-[11px] font-bold uppercase tracking-wide rounded px-2 py-0.5'
  if (d < 0) {
    return <span className={`${cls} bg-raised text-muted`}>termen depășit</span>
  }
  const urgent = d <= 10
  return (
    <span
      className={`${cls} text-white`}
      style={{ backgroundColor: urgent ? 'var(--color-against)' : 'var(--sidebar-bg)' }}
    >
      {d === 0 ? 'azi' : `${d} ${countNoun(d, 'zi', 'zile')}`}
    </span>
  )
}
