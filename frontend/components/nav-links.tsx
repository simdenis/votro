'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/saptamana',  label: 'Săptămâna' },
  { href: '/legi',       label: 'Legi' },
  { href: '/votes',      label: 'Voturi' },
  { href: '/senators',   label: 'Senatori' },
  { href: '/deputies',   label: 'Deputați' },
  { href: '/parties',    label: 'Partide' },
  { href: '/contribuie', label: 'Contribuie' },
  { href: '/despre',     label: 'Despre' },
]

export function NavLinks({ variant }: { variant?: 'sidebar' | 'top' }) {
  const path = usePathname()

  if (variant === 'sidebar') {
    return (
      <nav className="flex flex-col gap-1 px-3 py-5 flex-1">
        {LINKS.map(({ href, label }) => {
          const active = path === href || path.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              className={`px-3.5 py-3 rounded-lg border text-[17px] font-semibold tracking-tight transition-colors duration-150 ${
                active
                  ? 'bg-raised border-foreground/25 text-foreground shadow-sm'
                  : 'bg-surface border-rim text-foreground/70 hover:text-foreground hover:border-foreground/30 hover:bg-raised/50'
              }`}
            >
              {active && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-respins mr-2 mb-px" />
              )}
              {label}
            </Link>
          )
        })}
      </nav>
    )
  }

  // top bar fallback (mobile)
  return (
    <div className="flex gap-5 text-sm overflow-x-auto">
      {LINKS.map(({ href, label }) => {
        const active = path === href || path.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            className={`whitespace-nowrap transition-colors duration-150 ${
              active ? 'text-foreground font-medium' : 'text-muted hover:text-foreground'
            }`}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
