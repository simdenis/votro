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
  { href: '/tacite',     label: 'Termene tacite' },
  { href: '/contribuie', label: 'Contribuie' },
  { href: '/despre',     label: 'Despre' },
]

export function NavLinks({ variant }: { variant?: 'sidebar' | 'top' }) {
  const path = usePathname()

  if (variant === 'sidebar') {
    return (
      <nav className="flex flex-col gap-0.5 flex-1">
        {NAV_LINKS.map(({ href, label }) => {
          const active = path === href || path.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              className={`px-[12px] py-[10px] rounded-md text-[17px] transition-colors ${
                active
                  ? 'font-semibold text-white bg-white/[0.14]'
                  : 'font-medium text-white/85 hover:text-white hover:bg-white/[0.08]'
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
      {NAV_LINKS.map(({ href, label }) => {
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
