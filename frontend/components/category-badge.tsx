import { categoryColor } from '@/lib/category-colors'

/** Category chip tinted in the category's hue (same palette as the og cards).
 *  Falls back to the neutral raised chip for unknown categories. */
export function CategoryBadge({ category, className = 'text-xs' }: { category: string; className?: string }) {
  const color = categoryColor(category)
  if (!color) {
    return <span className={`${className} bg-raised border border-rim text-muted rounded px-2 py-0.5`}>{category}</span>
  }
  return (
    <span
      className={`${className} border rounded px-2 py-0.5 font-medium`}
      style={{ color, backgroundColor: `${color}14`, borderColor: `${color}40` }}
    >
      {category}
    </span>
  )
}
