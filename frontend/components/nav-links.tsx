'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Five clean top-level tabs; the rest live as section sub-navs (SectionNav).
export const NAV_LINKS: { href: string; label: string; match: string[] }[] = [
  { href: '/saptamana', label: 'Săptămâna',    match: ['/saptamana'] },
  { href: '/legi',      label: 'Legi',         match: ['/legi', '/votes', '/tacite'] },
  { href: '/senators',  label: 'Parlamentari', match: ['/senators', '/deputies', '/traseisti', '/parlamentarul-tau'] },
  { href: '/parties',   label: 'Partide',      match: ['/parties'] },
  { href: '/despre',    label: 'Despre',       match: ['/despre', '/contribuie'] },
]

/** Top-header nav per the brand mock: active = ink text with a 2px
    --vote-for underline sitting on the header's bottom border. */
export function NavLinks({ variant }: { variant?: 'top' }) {
  const path = usePathname()
  void variant

  return (
    <nav className="flex items-center gap-5 min-w-0 overflow-x-auto h-full">
      {NAV_LINKS.map(({ href, label, match }) => {
        const active = match.some(m => path === m || path.startsWith(`${m}/`))
        return (
          <Link
            key={href}
            href={href}
            className={`whitespace-nowrap text-[13px] h-full inline-flex items-center border-b-2 -mb-px transition-colors ${
              active
                ? 'font-semibold text-foreground border-adoptat'
                : 'font-medium text-muted border-transparent hover:text-foreground'
            }`}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
