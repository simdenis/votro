import Link from 'next/link'
import { NavLinks } from './nav-links'
import { ThemeToggle } from './theme-toggle'

export function Nav() {
  return (
    <>
      {/* ── Sidebar (desktop) ───────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-52 shrink-0 border-r border-rim bg-page sticky top-0 h-screen">
        <div className="px-6 py-5 border-b border-rim">
          <Link href="/" className="font-bold text-foreground text-xl tracking-tight">
            VotRO
          </Link>
        </div>

        <NavLinks variant="sidebar" />

        <div className="px-6 py-4 border-t border-rim flex items-center justify-between">
          <Link
            href="/search"
            className="text-muted hover:text-foreground transition-colors"
            aria-label="Căutare"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </Link>
          <ThemeToggle />
        </div>
      </aside>

      {/* ── Top bar (mobile) ────────────────────────────── */}
      <nav className="lg:hidden border-b border-rim bg-page sticky top-0 z-10">
        <div className="px-4 h-12 flex items-center justify-between gap-4">
          <Link href="/" className="font-bold text-foreground text-base tracking-tight shrink-0">
            VotRO
          </Link>
          <NavLinks variant="top" />
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/search" className="text-muted hover:text-foreground transition-colors" aria-label="Căutare">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>
    </>
  )
}
