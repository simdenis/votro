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
        className="text-muted hover:text-foreground p-1 -mr-1 transition-colors"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          {open
            ? <path d="M18 6 6 18M6 6l12 12" />
            : <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>}
        </svg>
      </button>

      {/* The white header grows downward to reveal the menu — no overlay.
          inert + aria-hidden: collapsed, the duplicate nav links must vanish
          from the a11y tree and tab order (crawlers see one nav, not two) */}
      <div
        className="absolute left-0 right-0 top-full overflow-hidden transition-[max-height] duration-300 ease-out bg-white border-b border-rim"
        style={{ maxHeight: open ? 720 : 0 }}
        inert={!open}
        aria-hidden={!open}
      >
        <nav className="flex flex-col px-4 pb-3">
          {NAV_LINKS.map(({ href, label, match, children }) => {
            const active = match.some(m => path === m || path.startsWith(`${m}/`))
            return (
              <div key={href} className="flex flex-col border-b border-rim/60 last:border-0">
                <Link
                  href={href}
                  className={`px-3 pt-3 pb-2 text-[16px] ${
                    active
                      ? 'font-semibold text-foreground border-l-2 border-l-adoptat pl-[10px]'
                      : 'font-medium text-muted'
                  }`}
                >
                  {label}
                </Link>
                {children && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 px-3 pb-3 pl-6">
                    {children.map(c => {
                      const childActive = path === c.href || path.startsWith(`${c.href}/`)
                      return (
                        <Link
                          key={c.href}
                          href={c.href}
                          className={`text-[14px] ${childActive ? 'font-semibold text-foreground' : 'text-faint'}`}
                        >
                          {c.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
          <Link href="/search" className="px-3 py-3 text-[16px] font-medium text-faint">
            Căutare
          </Link>
        </nav>
      </div>
    </>
  )
}
