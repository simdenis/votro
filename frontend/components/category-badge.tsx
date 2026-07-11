import Link from 'next/link'
import { categoryColor } from '@/lib/category-colors'

/** Category chip tinted in the category's hue (same palette as the og cards).
 *  className controls sizing; pass href to make it a filter link (defaults to
 *  the /legi list filtered on the category). */
export function CategoryBadge({
  category,
  className = 'text-xs px-2 py-0.5 rounded',
  href = `/legi?category=${encodeURIComponent(category)}`,
}: { category: string; className?: string; href?: string | null }) {
  const color = categoryColor(category)
  const chip = color ? (
    <span
      className={`${className} border font-medium ${href ? 'hover:brightness-75 transition' : ''}`}
      style={{ color, backgroundColor: `${color}14`, borderColor: `${color}40` }}
    >
      {category}
    </span>
  ) : (
    <span className={`${className} bg-raised border border-rim text-muted`}>{category}</span>
  )
  return href ? <Link href={href} className="inline-flex">{chip}</Link> : chip
}
