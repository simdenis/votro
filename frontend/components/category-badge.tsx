import { categoryColor } from '@/lib/category-colors'

/** Category chip tinted in the category's hue (same palette as the og cards).
 *  className controls sizing; color/border/background come from the palette.
 *  Falls back to the neutral raised chip for unknown categories. */
export function CategoryBadge({ category, className = 'text-xs px-2 py-0.5 rounded' }: { category: string; className?: string }) {
  const color = categoryColor(category)
  if (!color) {
    return <span className={`${className} bg-raised border border-rim text-muted`}>{category}</span>
  }
  return (
    <span
      className={`${className} border font-medium`}
      style={{ color, backgroundColor: `${color}14`, borderColor: `${color}40` }}
    >
      {category}
    </span>
  )
}
