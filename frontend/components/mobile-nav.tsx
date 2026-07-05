'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { NAV_LINKS } from './nav-links'

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const path = usePathname()

  // close the drawer whenever navigation happens
  useEffect(() => setOpen(false), [path])
  // no body scroll behind the open drawer
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

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

      {open && (
        <div
          className="fixed inset-x-0 top-12 bottom-0 z-20 overflow-y-auto"
          style={{ backgroundColor: 'var(--sidebar-bg)' }}
        >
          <nav className="flex flex-col px-4 py-3">
            {NAV_LINKS.map(({ href, label }) => {
              const active = path === href || path.startsWith(`${href}/`)
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-3.5 rounded-md text-[17px] border-b border-white/[0.06] last:border-0 ${
                    active ? 'font-semibold text-white bg-white/[0.10]' : 'font-medium text-white/85'
                  }`}
                >
                  {label}
                </Link>
              )
            })}
            <Link href="/search" className="px-3 py-3.5 text-[17px] font-medium text-white/60">
              Căutare
            </Link>
          </nav>
        </div>
      )}
    </>
  )
}
