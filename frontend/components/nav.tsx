import Link from 'next/link'
import { NavLinks } from './nav-links'

const SearchIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
  </svg>
)

export function Nav() {
  return (
    <>
      {/* ── Sidebar (desktop) ───────────────────────────── */}
      <aside
        className="hidden lg:flex flex-col w-[228px] shrink-0 sticky top-0 h-screen px-[18px] pt-[26px] pb-5"
        style={{ backgroundColor: 'var(--sidebar-bg)' }}
      >
        <Link href="/" className="block mb-7">
          <div className="font-serif text-[26px] text-white leading-none">VotRO</div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-white/35 mt-1">Senat · Cameră · 2026</div>
          {/* Romanian flag stripe — right under the wordmark, always visible */}
          <div className="flex h-[4px] rounded-sm overflow-hidden gap-px mt-3.5">
            <div className="flex-1" style={{ backgroundColor: 'var(--flag-blue)' }} />
            <div className="flex-1" style={{ backgroundColor: 'var(--flag-yellow)' }} />
            <div className="flex-1" style={{ backgroundColor: 'var(--flag-red)' }} />
          </div>
        </Link>

        <NavLinks variant="sidebar" />

        <div className="pt-[18px] border-t border-white/10">
          <Link
            href="/search"
            className="flex items-center gap-2 text-[13px] font-medium text-white/45 px-[11px] py-[7px] rounded-md hover:text-white/75 hover:bg-white/[0.06] transition-colors"
          >
            <SearchIcon /> Căutare
          </Link>
        </div>
      </aside>

      {/* ── Top bar (mobile) ────────────────────────────── */}
      <nav className="lg:hidden sticky top-0 z-10" style={{ backgroundColor: 'var(--sidebar-bg)' }}>
        <div className="px-4 h-12 flex items-center justify-between gap-4">
          <Link href="/" className="font-serif text-white text-lg leading-none shrink-0">VotRO</Link>
          <NavLinks variant="top" />
          <Link href="/search" className="text-white/50 hover:text-white transition-colors shrink-0" aria-label="Căutare">
            <SearchIcon size={15} />
          </Link>
        </div>
      </nav>
    </>
  )
}
