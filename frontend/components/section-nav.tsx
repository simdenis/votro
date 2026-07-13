'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export interface SectionItem {
  href: string
  label: string
}

// Section groupings behind the 5 top-level tabs.
export const LEGI_SECTIONS: SectionItem[] = [
  { href: '/legi', label: 'Legi' },
  { href: '/voturi', label: 'Voturi' },
  { href: '/tacite', label: 'Legi tacite' },
]

export const PARLAMENTARI_SECTIONS: SectionItem[] = [
  { href: '/senatori', label: 'Senatori' },
  { href: '/deputati', label: 'Deputați' },
  { href: '/traseisti', label: 'Traseiști' },
  { href: '/parlamentarul-tau', label: 'Parlamentarul tău' },
]

export const DESPRE_SECTIONS: SectionItem[] = [
  { href: '/despre', label: 'Despre' },
  { href: '/date', label: 'Date deschise' },
  { href: '/contribuie', label: 'Contribuie' },
]

/** Pill sub-nav inside a top-level section (chip style shared with /legi filters). */
export function SectionNav({ items }: { items: SectionItem[] }) {
  const path = usePathname()
  return (
    <div className="flex gap-1.5 flex-wrap mb-6">
      {items.map(({ href, label }) => {
        const active = path === href || path.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            className={`text-[13px] px-3.5 py-1.5 rounded-full border font-medium transition-colors ${
              active
                ? 'border-ink text-white bg-ink'
                : 'border-rim text-foreground/75 hover:text-foreground hover:border-foreground/40 hover:bg-raised'
            }`}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
