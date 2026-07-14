'use client'

import { useMemo, useState } from 'react'
import { textOnColor } from '@/lib/utils'

export interface MatrixParty { abbr: string; color: string }
export interface AgreementBucket { party_a: string; party_b: string; month: string; shared: number; agreed: number }

interface Props {
  parties: MatrixParty[]
  months: string[]        // sorted 'YYYY-MM'
  monthLabels: string[]   // display, same order
  buckets: AgreementBucket[]
}

// Sequential single-hue ramp (one blue, light→dark = low→high agreement) as
// opacity over the surface. Neutral — the % label carries the exact value.
const BASE = '47, 111, 208'
function cellBg(pct: number): { bg: string; ink: string } {
  const a = Math.max(0, Math.min(1, (pct - 30) / 70)) * 0.92 + 0.05
  return { bg: `rgba(${BASE}, ${a.toFixed(2)})`, ink: a > 0.5 ? '#fff' : 'var(--ink)' }
}

const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

export function AgreementMatrix({ parties, months, monthLabels, buckets }: Props) {
  const [from, setFrom] = useState(0)
  const [to, setTo] = useState(Math.max(0, months.length - 1))

  // Sum agreed/shared across the selected month window, per party pair.
  const pair = useMemo(() => {
    const lo = months[Math.min(from, to)], hi = months[Math.max(from, to)]
    const acc: Record<string, { shared: number; agreed: number }> = {}
    for (const b of buckets) {
      if (b.month < lo || b.month > hi) continue
      const rec = (acc[key(b.party_a, b.party_b)] ??= { shared: 0, agreed: 0 })
      rec.shared += b.shared; rec.agreed += b.agreed
    }
    return acc
  }, [buckets, months, from, to])

  const windowLabel = `${monthLabels[Math.min(from, to)]} – ${monthLabels[Math.max(from, to)]}`
  const cols = `minmax(52px, auto) repeat(${parties.length}, minmax(0, 1fr))`

  return (
    <div className="space-y-4">
      {/* time window */}
      <div className="flex flex-col gap-2 bg-surface border border-rim rounded-lg p-3.5 max-w-md">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] uppercase tracking-widest text-muted font-semibold">Perioadă</span>
          <span className="text-[12.5px] font-medium text-foreground tabular-nums">{windowLabel}</span>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-faint">
          <span className="w-10 flex-shrink-0">De la</span>
          <input type="range" min={0} max={months.length - 1} value={from}
                 onChange={e => setFrom(Math.min(+e.target.value, to))} className="flex-1 accent-[var(--sidebar-bg)]" />
        </label>
        <label className="flex items-center gap-2 text-[11px] text-faint">
          <span className="w-10 flex-shrink-0">Până la</span>
          <input type="range" min={0} max={months.length - 1} value={to}
                 onChange={e => setTo(Math.max(+e.target.value, from))} className="flex-1 accent-[var(--sidebar-bg)]" />
        </label>
      </div>

      <div className="overflow-x-auto">
        <div className="grid gap-[2px] min-w-[480px]" style={{ gridTemplateColumns: cols }}>
          <div />
          {parties.map(p => (
            <div key={p.abbr} className="flex items-center justify-center pb-1.5">
              <span className="text-[11px] font-semibold" style={{ color: p.color }}>{p.abbr}</span>
            </div>
          ))}

          {parties.map(rowP => (
            <div key={rowP.abbr} className="contents">
              <div className="flex items-center gap-1.5 pr-2">
                <span className="w-[9px] h-[9px] rounded-[2px] flex-shrink-0" style={{ backgroundColor: rowP.color }} />
                <span className="text-[11px] font-semibold text-foreground">{rowP.abbr}</span>
              </div>
              {parties.map(colP => {
                if (rowP.abbr === colP.abbr) {
                  return (
                    <div key={colP.abbr} className="aspect-square rounded-[3px] flex items-center justify-center"
                         style={{ backgroundColor: rowP.color }}>
                      <span className="text-[9px] font-bold" style={{ color: textOnColor(rowP.color) }}>{rowP.abbr}</span>
                    </div>
                  )
                }
                const rec = pair[key(rowP.abbr, colP.abbr)]
                if (!rec || rec.shared < 3) {
                  return <div key={colP.abbr} className="aspect-square rounded-[3px] bg-raised" title="Prea puține voturi disputate comune în această perioadă" />
                }
                const pct = Math.round((rec.agreed / rec.shared) * 100)
                const { bg, ink } = cellBg(pct)
                return (
                  <div key={colP.abbr}
                       className="aspect-square rounded-[3px] flex items-center justify-center tabular-nums cursor-default"
                       style={{ backgroundColor: bg }}
                       title={`${rowP.abbr} și ${colP.abbr} au votat la fel de ${rec.agreed} ori din ${rec.shared} voturi disputate comune (${windowLabel})`}>
                    <span className="text-[11px] font-semibold" style={{ color: ink }}>{pct}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
