import Link from 'next/link'
import { textOnColor } from '@/lib/utils'

interface Props {
  abbreviation: string
  color?: string | null
  size?: 'sm' | 'md'
  noLink?: boolean
}

export function PartyBadge({ abbreviation, color, size = 'sm', noLink }: Props) {
  const bg = color ?? '#9e9e9e'
  const fg = textOnColor(bg)
  const cls = `inline-flex items-center rounded-full font-semibold ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'}`
  if (noLink) {
    return (
      <span className={cls} style={{ backgroundColor: bg, color: fg }}>
        {abbreviation}
      </span>
    )
  }
  return (
    <Link
      href={`/parties/${abbreviation}`}
      className={`${cls} hover:opacity-75 transition-opacity`}
      style={{ backgroundColor: bg, color: fg }}
    >
      {abbreviation}
    </Link>
  )
}
