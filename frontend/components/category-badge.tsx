import Link from 'next/link'
import { categoryColor } from '@/lib/category-colors'

/** Category as plain text in the category's hue (no chip). className sizes it;
 *  pass href to make it a filter link (defaults to /legi filtered on the category). */
export function CategoryBadge({
  category,
  className = 'text-[12.5px]',
  href = `/legi?category=${encodeURIComponent(category)}`,
}: { category: string; className?: string; href?: string | null }) {
  const color = categoryColor(category)
  // sizing only: padding/radius classes from the old chip API are ignored
  const size = className.split(' ').filter(c => c.startsWith('text-')).join(' ') || 'text-[12.5px]'
  const label = (
    <span className={`${size} font-medium ${href ? 'hover:opacity-75 transition-opacity' : ''}`} style={{ color: color ?? 'var(--muted)' }}>
      {category}
    </span>
  )
  return href ? <Link href={href} className="inline-flex">{label}</Link> : label
}
