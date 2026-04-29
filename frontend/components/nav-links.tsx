'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/legi',     label: 'Legi' },
  { href: '/votes',    label: 'Voturi' },
  { href: '/senators', label: 'Senatori' },
  { href: '/deputies', label: 'Deputați' },
  { href: '/parties',  label: 'Partide' },
  { href: '/despre',   label: 'Despre' },
]

export function NavLinks() {
  const path = usePathname()
  return (
    <div className="flex gap-6 text-sm">
      {LINKS.map(({ href, label }) => {
        const active = path === href || path.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            className={`transition-colors duration-150 flex flex-col items-center gap-1 ${
              active ? 'text-foreground' : 'text-muted hover:text-foreground'
            }`}
          >
            {label}
            <span
              className={`h-0.5 rounded-full transition-all duration-200 ${
                active ? 'w-full bg-respins' : 'w-0 bg-transparent'
              }`}
            />
          </Link>
        )
      })}
    </div>
  )
}
