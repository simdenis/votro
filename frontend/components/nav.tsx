import Link from 'next/link'
import { Logo } from './logo'
import { NavLinks } from './nav-links'
import { MobileNav } from './mobile-nav'

const SearchIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
  </svg>
)

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

          <div className="ml-auto flex items-center gap-4 shrink-0">
            <Link
              href="/search"
              aria-label="Căutare"
              className="text-muted hover:text-foreground transition-colors p-1"
            >
              <SearchIcon size={15} />
            </Link>
            <span className="hidden xl:inline-block font-mono text-[9.5px] tracking-[0.1em] text-muted border border-[var(--color-absent)] rounded-[3px] px-2 py-[3px] select-none whitespace-nowrap">
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
