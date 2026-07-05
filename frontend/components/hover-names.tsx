/** Pure-CSS hover tooltip listing people behind a number. Server-safe (no JS);
 *  on touch devices the full lists remain available below, so this is an
 *  enhancement, not the only path to the information. */

const MAX_SHOWN = 14

export function HoverNames({
  names,
  title,
  children,
}: {
  names: string[]
  title?: string
  children: React.ReactNode
}) {
  if (!names.length) return <>{children}</>
  const shown = names.slice(0, MAX_SHOWN)
  const more = names.length - shown.length
  return (
    <span className="relative group/hn inline-block cursor-help underline decoration-dotted decoration-rim underline-offset-2">
      {children}
      <span className="pointer-events-none invisible group-hover/hn:visible absolute z-30 left-1/2 -translate-x-1/2 bottom-full mb-2 w-max max-w-[300px] rounded-lg border border-rim bg-surface shadow-lg px-3.5 py-3 text-left">
        {title && (
          <span className="block text-[10px] uppercase tracking-widest text-faint mb-1.5 whitespace-nowrap">
            {title}
          </span>
        )}
        <span className="block text-xs text-foreground leading-relaxed normal-case">
          {shown.join(' · ')}
          {more > 0 && <span className="text-muted"> și încă {more}</span>}
        </span>
      </span>
    </span>
  )
}
