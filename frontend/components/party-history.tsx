import type { PartyHistoryEntry } from '@/lib/types'

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ro-RO', { month: 'short', year: 'numeric' })
}

function duration(from: string, to: string | null) {
  const start = new Date(from)
  const end   = to ? new Date(to) : new Date()
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  if (months < 1)  return '< 1 lună'
  if (months < 12) return `${months} lun${months === 1 ? 'ă' : 'i'}`
  const y = Math.floor(months / 12)
  const m = months % 12
  return m === 0 ? `${y} an${y > 1 ? 'i' : ''}` : `${y}a ${m}l`
}

interface Props {
  history: PartyHistoryEntry[]
}

export function PartyHistory({ history }: Props) {
  if (history.length < 2) return null

  return (
    <div className="bg-surface border border-rim rounded-xl p-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-5">
        Parcurs politic
      </h2>

      <div className="flex items-start gap-0 overflow-x-auto pb-1 -mx-1 px-1">
        {history.map((entry, i) => {
          const isCurrent = !entry.to_date
          const color     = entry.parties.color ?? '#9e9e9e'
          const abbr      = entry.parties.abbreviation

          return (
            <div key={entry.id} className="flex items-start flex-shrink-0">

              {/* Party step */}
              <div className="flex flex-col items-center gap-2 min-w-[80px] max-w-[100px]">
                <div
                  className="relative px-3 py-1.5 rounded-lg text-sm font-extrabold text-white leading-none select-none"
                  style={{ backgroundColor: color }}
                >
                  {abbr}
                  {isCurrent && (
                    <span
                      className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white"
                      style={{ backgroundColor: '#22c55e' }}
                      title="Partid actual"
                    />
                  )}
                </div>

                <div className="text-center">
                  <p className="text-[10px] text-foreground font-medium leading-tight">
                    {fmt(entry.from_date)} – {isCurrent ? 'prezent' : fmt(entry.to_date!)}
                  </p>
                  <p className="text-[10px] text-faint leading-tight mt-0.5">
                    {duration(entry.from_date, entry.to_date)}
                  </p>
                </div>
              </div>

              {/* Arrow connector */}
              {i < history.length - 1 && (
                <div className="flex items-center mt-3 mx-1.5 text-muted flex-shrink-0">
                  <svg width="24" height="10" viewBox="0 0 24 10" fill="none">
                    <line x1="0" y1="5" x2="18" y2="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
                    <polyline points="14,1 19,5 14,9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </div>
              )}

            </div>
          )
        })}
      </div>
    </div>
  )
}
