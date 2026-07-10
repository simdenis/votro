'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export const NAV_LINKS = [
  { href: '/saptamana',  label: 'Săptămâna' },
  { href: '/legi',       label: 'Legi' },
  { href: '/votes',      label: 'Voturi' },
  { href: '/senators',   label: 'Senatori' },
  { href: '/deputies',   label: 'Deputați' },
  { href: '/parties',    label: 'Partide' },
  { href: '/traseisti',  label: 'Traseiști' },
  { href: '/parlamentarul-tau', label: 'Parlamentarul tău' },
  { href: '/tacite',     label: 'Legi tacite' },
  { href: '/contribuie', label: 'Contribuie' },
  { href: '/despre',     label: 'Despre' },
]

/** Top-header nav per the brand mock: 12.5px items, active = ink text with a
    2px --vote-for underline sitting on the header's bottom border. */
export function NavLinks({ variant }: { variant?: 'top' }) {
  const path = usePathname()
  void variant

  return (
    <nav className="flex items-center gap-4 min-w-0 overflow-x-auto h-full">
      {NAV_LINKS.map(({ href, label }) => {
        const active = path === href || path.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            className={`whitespace-nowrap text-[12.5px] h-full inline-flex items-center border-b-2 -mb-px transition-colors ${
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
