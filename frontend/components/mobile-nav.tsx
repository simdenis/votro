'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { NAV_LINKS } from './nav-links'

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const path = usePathname()

  // collapse the menu whenever navigation happens
  useEffect(() => setOpen(false), [path])

  return (
    <>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={open ? 'Închide meniul' : 'Deschide meniul'}
        aria-expanded={open}
        className="text-white/85 hover:text-white p-1 -mr-1"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          {open
            ? <path d="M18 6 6 18M6 6l12 12" />
            : <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>}
        </svg>
      </button>

      {/* The navy bar simply grows downward to reveal the menu — no overlay */}
      <div
        className="absolute left-0 right-0 top-full overflow-hidden transition-[max-height] duration-300 ease-out"
        style={{ maxHeight: open ? 640 : 0, backgroundColor: 'var(--sidebar-bg)' }}
      >
        <nav className="flex flex-col px-4 pb-3">
          {NAV_LINKS.map(({ href, label }) => {
            const active = path === href || path.startsWith(`${href}/`)
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-3 rounded-md text-[16px] border-b border-white/[0.06] last:border-0 ${
                  active ? 'font-semibold text-white bg-white/[0.10]' : 'font-medium text-white/85'
                }`}
              >
                {label}
              </Link>
            )
          })}
          <Link href="/search" className="px-3 py-3 text-[16px] font-medium text-white/60">
            Căutare
          </Link>
        </nav>
      </div>
    </>
  )
}
