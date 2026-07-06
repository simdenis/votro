'use client'

import { useRouter } from 'next/navigation'
import { RO_MAP_VIEWBOX, RO_COUNTIES } from '@/lib/ro-counties'

/** Clickable map of Romania's counties. Each county navigates to
 *  /parlamentarul-tau?judet=<name>; Diaspora is a separate button (no geography). */
export function CountyMap({ selected }: { selected?: string }) {
  const router = useRouter()
  const go = (judet: string) => router.push(`/parlamentarul-tau?judet=${encodeURIComponent(judet)}`)

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-rim rounded-2xl p-3 sm:p-5">
        <svg
          viewBox={RO_MAP_VIEWBOX}
          className="w-full h-auto"
          role="group"
          aria-label="Harta județelor României — alege un județ"
        >
          {RO_COUNTIES.map(({ name, d }) => {
            const active = name === selected
            return (
              <path
                key={name}
                d={d}
                tabIndex={0}
                role="button"
                aria-label={name}
                aria-pressed={active}
                onClick={() => go(name)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(name) }
                }}
                className="cursor-pointer outline-none transition-colors [transition:fill_120ms] focus-visible:stroke-[var(--flag-yellow)]"
                style={{
                  fill: active ? 'var(--sidebar-bg)' : 'var(--raised)',
                  stroke: active ? 'var(--sidebar-bg)' : 'var(--rim)',
                  strokeWidth: active ? 1.5 : 0.8,
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.fill = 'var(--flag-blue)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.fill = 'var(--raised)' }}
              >
                <title>{name}</title>
              </path>
            )
          })}
        </svg>
      </div>

      <div className="flex items-center justify-center">
        <button
          onClick={() => go('Diaspora')}
          aria-pressed={selected === 'Diaspora'}
          className={`text-sm font-medium rounded-full px-5 py-2 border transition-colors ${
            selected === 'Diaspora'
              ? 'text-white border-transparent'
              : 'text-foreground border-rim hover:border-foreground'
          }`}
          style={selected === 'Diaspora' ? { backgroundColor: 'var(--sidebar-bg)' } : undefined}
        >
          🌍 Diaspora — românii din străinătate
        </button>
      </div>
    </div>
  )
}
