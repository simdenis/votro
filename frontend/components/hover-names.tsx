/** Pure-CSS hover tooltip listing people behind a number, each name in their
 *  party colour. Server-safe (no JS); on touch devices the full lists remain
 *  available below, so this is an enhancement, not the only path. */

const MAX_SHOWN = 14

export interface HoverPerson {
  name: string
  color?: string
  party?: string
}

export function HoverNames({
  people,
  title,
  children,
}: {
  people: HoverPerson[]
  title?: string
  children: React.ReactNode
}) {
  if (!people.length) return <>{children}</>
  const shown = people.slice(0, MAX_SHOWN)
  const more = people.length - shown.length
  return (
    <span className="relative group/hn inline-block cursor-help underline decoration-dotted decoration-rim underline-offset-2">
      {children}
      <span className="pointer-events-none invisible group-hover/hn:visible absolute z-30 left-1/2 -translate-x-1/2 bottom-full mb-2 w-max max-w-[320px] rounded-lg border border-rim bg-surface shadow-lg px-3.5 py-3 text-left">
        {title && (
          <span className="block text-[10px] uppercase tracking-widest text-faint mb-2 whitespace-nowrap">
            {title}
          </span>
        )}
        <span className="flex flex-col gap-1 text-xs leading-snug normal-case">
          {shown.map((p, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: p.color ?? 'var(--muted)' }}
              />
              <span className="text-foreground">{p.name}</span>
              {p.party && <span className="text-faint">· {p.party}</span>}
            </span>
          ))}
          {more > 0 && <span className="text-muted mt-0.5">și încă {more}</span>}
        </span>
      </span>
    </span>
  )
}
