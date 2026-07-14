'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LEGI_SECTIONS, PARLAMENTARI_SECTIONS, DESPRE_SECTIONS, type SectionItem } from './section-nav'

// Five clean top-level tabs; sections with children get a hover dropdown.
export const NAV_LINKS: { href: string; label: string; match: string[]; children?: SectionItem[] }[] = [
  { href: '/saptamana', label: 'Săptămâna',    match: ['/saptamana'] },
  { href: '/legi',      label: 'Legi',         match: ['/legi', '/voturi', '/tacite'], children: LEGI_SECTIONS },
  { href: '/senatori',  label: 'Parlamentari', match: ['/senatori', '/deputati', '/traseisti', '/parlamentarul-tau'], children: PARLAMENTARI_SECTIONS },
  { href: '/partide',   label: 'Partide',      match: ['/partide'] },
  { href: '/analize',   label: 'Analize',      match: ['/analize'] },
  { href: '/despre',    label: 'Despre',       match: ['/despre', '/date', '/contribuie'], children: DESPRE_SECTIONS },
]

/** Top-header nav per the brand mock: active = ink text with a 2px
    --vote-for underline. Sections with children reveal a dropdown on
    hover/focus (CSS-only: group-hover + focus-within). */
export function NavLinks({ variant }: { variant?: 'top' }) {
  const path = usePathname()
  void variant

  return (
    <nav className="flex items-center gap-5 min-w-0 h-full">
      {NAV_LINKS.map(({ href, label, match, children }) => {
        const active = match.some(m => path === m || path.startsWith(`${m}/`))
        const linkCls = `whitespace-nowrap text-[13px] h-full inline-flex items-center border-b-2 -mb-px transition-colors ${
          active
            ? 'font-semibold text-foreground border-adoptat'
            : 'font-medium text-muted border-transparent hover:text-foreground'
        }`

        if (!children) {
          return (
            <Link key={href} href={href} className={linkCls}>
              {label}
            </Link>
          )
        }

        return (
          <div key={href} className="relative group h-full flex items-center">
            <Link href={href} className={linkCls}>
              {label}
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="ml-1 opacity-50">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </Link>
            {/* hover dropdown — top-full keeps it glued to the trigger (no gap) */}
            <div className="absolute left-0 top-full hidden group-hover:flex group-focus-within:flex flex-col bg-white border border-rim rounded-lg py-1.5 min-w-[190px] z-30 shadow-[0_10px_28px_rgba(23,26,31,0.08)]">
              {children.map(c => {
                const childActive = path === c.href || path.startsWith(`${c.href}/`)
                return (
                  <Link
                    key={c.href}
                    href={c.href}
                    className={`px-4 py-2 text-[13px] transition-colors ${
                      childActive
                        ? 'font-semibold text-foreground'
                        : 'font-medium text-muted hover:text-foreground hover:bg-raised'
                    }`}
                  >
                    {c.label}
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}
    </nav>
  )
}
