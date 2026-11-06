'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RO_MAP_VIEWBOX, RO_COUNTIES } from '@/lib/ro-counties'
import { textOnColor } from '@/lib/utils'
import type { CountyLeader } from '@/lib/county-leaders'

/** Clickable map of Romania's counties. Each county navigates to
 *  /parlamentarul-tau?judet=<name>; Diaspora is a separate button (no geography).
 *  On hover a county takes the colour of the party with the most MPs elected there
 *  (`leaders`, computed on the server); a tie shows the tied parties in equal stripes. */
export function CountyMap({ selected, leaders = {} }: { selected?: string; leaders?: Record<string, CountyLeader> }) {
  const router = useRouter()
  const [hover, setHover] = useState<string | null>(null)
  // scroll:false — the results section scrolls itself into view instead
  const go = (judet: string) => router.push(`/parlamentarul-tau?judet=${encodeURIComponent(judet)}`, { scroll: false })

  return (
    <div className="space-y-4">
      <div className="border-t border-rim py-3 sm:py-5">
        <svg
          viewBox={RO_MAP_VIEWBOX}
          className="w-full h-auto"
          role="group"
          aria-label="Harta județelor României — alege un județ"
        >
          <defs>
            {hover && (leaders[hover]?.parties.length ?? 0) > 1 && (
              <linearGradient id="county-tie" x1="0" y1="0" x2="1" y2="1">
                {leaders[hover]!.parties.flatMap((p, i, a) => [
                  <stop key={`${p.abbr}a`} offset={i / a.length} stopColor={p.color} />,
                  <stop key={`${p.abbr}b`} offset={(i + 1) / a.length} stopColor={p.color} />,
                ])}
              </linearGradient>
            )}
          </defs>
          {RO_COUNTIES.map(({ name, d }) => {
            const active = name === selected
            const lead = hover === name && !active ? leaders[name] : undefined
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
                  fill: active ? 'var(--sidebar-bg)' : lead ? (lead.parties.length > 1 ? 'url(#county-tie)' : lead.parties[0].color) : hover === name ? '#C4CAD3' : '#E7E9EC',
                  stroke: 'var(--sidebar-bg)',
                  strokeWidth: active ? 3.5 : 2.2,
                  strokeLinejoin: 'round',
                }}
                onMouseEnter={() => setHover(name)}
                onMouseLeave={() => setHover(h => (h === name ? null : h))}
              >
                <title>{leaders[name] ? `${name} · cei mai mulți parlamentari: ${leaders[name].parties.map(p => p.abbr).join(' și ')} (${leaders[name].seats} din ${leaders[name].total}${leaders[name].parties.length > 1 ? ' fiecare' : ''})` : name}</title>
              </path>
            )
          })}
          {/* Abbreviation labels — non-interactive so clicks fall through to the county */}
          {RO_COUNTIES.map(({ name, abbr, lx, ly }) => {
            const lead = hover === name && name !== selected ? leaders[name] : undefined
            return (
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
                fill: name === selected ? '#ffffff' : lead ? (lead.parties.some(p => textOnColor(p.color.toLowerCase()) === '#000000') ? '#000000' : '#ffffff') : 'var(--sidebar-bg)',
                paintOrder: 'stroke',
                stroke: lead && lead.parties.length > 1 ? 'rgba(255,255,255,0.85)' : 'none',
                strokeWidth: 3,
              }}
            >
              {abbr}
            </text>
            )
          })}
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
