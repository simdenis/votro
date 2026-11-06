import Link from 'next/link'
import { Logo } from './logo'
import { NavLinks } from './nav-links'
import { MobileNav } from './mobile-nav'
import { Feedback } from './feedback'
import { ReportMistake } from './report-mistake'
import { HeaderSearch } from './header-search'

/** White top header per the brand mock: glyph + wordmark, 12.5px nav with a
    2px green underline on the active item, NEAFILIAT POLITIC mono badge. */
export function Nav() {
  return (
    <header className="sticky top-0 z-20 bg-white border-b border-rim">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-14">

        {/* ── Desktop ────────────────────────────────────── */}
        <div className="hidden lg:flex items-center gap-6 h-[58px]">
          <Link href="/" className="shrink-0 flex items-center">
            <Logo size={34} />
          </Link>

          <NavLinks variant="top" />

          <div className="ml-auto flex items-center gap-3.5 shrink-0">
            <HeaderSearch />
            <Feedback label="Feedback" className="whitespace-nowrap" />
            <ReportMistake label="Eroare" className="whitespace-nowrap" />
            <span className="hidden xl:inline-block font-mono text-[9.5px] tracking-[0.1em] text-muted border border-[var(--ink)] rounded-[3px] px-2 py-[3px] select-none whitespace-nowrap">
              NEAFILIAT POLITIC
            </span>
          </div>
        </div>

        {/* ── Mobile ─────────────────────────────────────── */}
        <div className="lg:hidden flex items-center justify-between h-12 relative">
          <Link href="/" className="flex items-center shrink-0">
            <Logo size={28} />
          </Link>
          <MobileNav />
        </div>
      </div>
    </header>
  )
}
