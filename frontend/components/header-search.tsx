'use client'

import { usePathname } from 'next/navigation'

const SearchIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
  </svg>
)

/** Compact header search. Hidden on the homepage, whose hero already has the big one. */
export function HeaderSearch() {
  if (usePathname() === '/') return null
  return (
    <form action="/cautare" className="relative">
      <input
        name="q"
        type="search"
        placeholder="Caută…"
        aria-label="Caută un parlamentar sau o lege"
        className="w-36 focus:w-56 bg-raised border border-rim rounded-full pl-3.5 pr-8 py-1.5 text-[13px] text-foreground placeholder:text-faint focus:outline-none focus:border-foreground/40 transition-[width,border-color]"
      />
      <button type="submit" aria-label="Caută" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors">
        <SearchIcon />
      </button>
    </form>
  )
}
