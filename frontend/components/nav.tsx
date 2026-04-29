import Link from 'next/link'
import { NavLinks } from './nav-links'
import { ThemeToggle } from './theme-toggle'

export function Nav() {
  return (
    <nav className="border-b border-rim bg-page">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold text-foreground text-lg tracking-tight">
          VotRO
        </Link>
        <div className="flex items-center gap-4">
          <NavLinks />
          <ThemeToggle />
        </div>
      </div>
    </nav>
  )
}
