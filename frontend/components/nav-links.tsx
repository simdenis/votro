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
      <nav className="flex flex-col gap-0.5 flex-1">
        {LINKS.map(({ href, label }) => {
          const active = path === href || path.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              className={`px-[11px] py-[7px] rounded-md text-[13px] transition-colors ${
                active
                  ? 'font-semibold text-white bg-white/[0.12]'
                  : 'font-medium text-white/45 hover:text-white/75 hover:bg-white/[0.06]'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </nav>
    )
  }

  // top bar fallback (mobile) — navy bar, white text
  return (
    <div className="flex gap-5 text-[13px] overflow-x-auto">
      {LINKS.map(({ href, label }) => {
        const active = path === href || path.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            className={`whitespace-nowrap transition-colors ${
              active ? 'text-white font-semibold' : 'text-white/55 hover:text-white'
            }`}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
