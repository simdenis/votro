'use client'

import { useRouter } from 'next/navigation'
import { RO_MAP_VIEWBOX, RO_COUNTIES } from '@/lib/ro-counties'

/** Clickable map of Romania's counties. Each county navigates to
 *  /parlamentarul-tau?judet=<name>; Diaspora is a separate button (no geography). */
export function CountyMap({ selected }: { selected?: string }) {
  const router = useRouter()
  // scroll:false — the results section scrolls itself into view instead
  const go = (judet: string) => router.push(`/parlamentarul-tau?judet=${encodeURIComponent(judet)}`, { scroll: false })

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
                className="cursor-pointer outline-none [transition:fill_120ms] focus-visible:stroke-[var(--color-abstention)]"
                style={{
                  fill: active ? 'var(--sidebar-bg)' : '#E7E9EC',
                  stroke: 'var(--sidebar-bg)',
                  strokeWidth: active ? 3.5 : 2.2,
                  strokeLinejoin: 'round',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.fill = '#C4CAD3' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.fill = '#E7E9EC' }}
              >
                <title>{name}</title>
              </path>
            )
          })}
          {/* Abbreviation labels — non-interactive so clicks fall through to the county */}
          {RO_COUNTIES.map(({ name, abbr, lx, ly }) => (
            <text
              key={`t-${name}`}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="central"
              className="pointer-events-none select-none"
              style={{
                fontSize: 15,
                fontWeight: 700,
                fill: name === selected ? '#ffffff' : 'var(--sidebar-bg)',
              }}
            >
              {abbr}
            </text>
          ))}
        </svg>
      </div>

      <div className="flex items-center justify-center gap-3 flex-wrap">
        {[
          { judet: 'Diaspora', label: 'Diaspora — românii din străinătate' },
          { judet: 'Minorități', label: 'Minorități naționale — aleși la nivel național' },
        ].map(({ judet, label }) => (
          <button
            key={judet}
            onClick={() => go(judet)}
            aria-pressed={selected === judet}
            className={`text-sm font-medium rounded-full px-5 py-2 border transition-colors ${
              selected === judet
                ? 'text-white border-transparent'
                : 'text-foreground border-rim hover:border-foreground'
            }`}
            style={selected === judet ? { backgroundColor: 'var(--sidebar-bg)' } : undefined}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
