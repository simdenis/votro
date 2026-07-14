import { textOnColor } from '@/lib/utils'

export interface MatrixParty { abbr: string; color: string }
export interface AgreementCell { pct: number; shared: number }

interface Props {
  parties: MatrixParty[]
  /** cell[a][b] — symmetric agreement %; missing pair = null */
  cell: (a: string, b: string) => AgreementCell | null
}

// Sequential single-hue ramp (one blue, light→dark = low→high agreement),
// as opacity of one base blue over the surface. Neutral, no judgment color —
// the % label in each cell carries the exact value (contrast relief).
const BASE = '47, 111, 208' // #2f6fd0
function cellBg(pct: number): { bg: string; ink: string } {
  const a = Math.max(0, Math.min(1, (pct - 30) / 70)) * 0.92 + 0.05
  return { bg: `rgba(${BASE}, ${a.toFixed(2)})`, ink: a > 0.5 ? '#fff' : 'var(--ink)' }
}

/** Pairwise party agreement on contested votes — a symmetric heatmap. Read a
 *  row across: how often that party's majority matched each other party's. */
export function AgreementMatrix({ parties, cell }: Props) {
  const cols = `minmax(60px, auto) repeat(${parties.length}, minmax(0, 1fr))`
  return (
    <div className="overflow-x-auto">
      <div className="grid gap-[2px] min-w-[520px]" style={{ gridTemplateColumns: cols }}>
        {/* header row */}
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
                  <div
                    key={colP.abbr}
                    className="aspect-square rounded-[3px] flex items-center justify-center"
                    style={{ backgroundColor: rowP.color }}
                  >
                    <span className="text-[9px] font-bold" style={{ color: textOnColor(rowP.color) }}>{rowP.abbr}</span>
                  </div>
                )
              }
              const c = cell(rowP.abbr, colP.abbr)
              if (!c) {
                return <div key={colP.abbr} className="aspect-square rounded-[3px] bg-raised" />
              }
              const { bg, ink } = cellBg(c.pct)
              return (
                <div
                  key={colP.abbr}
                  className="aspect-square rounded-[3px] flex items-center justify-center tabular-nums"
                  style={{ backgroundColor: bg }}
                  title={`${rowP.abbr} și ${colP.abbr} au votat la fel în ${c.pct}% din ${c.shared} voturi disputate comune`}
                >
                  <span className="text-[11px] font-semibold" style={{ color: ink }}>{c.pct}</span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
