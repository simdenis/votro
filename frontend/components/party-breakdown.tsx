import type { PartyVoteBreakdown, VoteChoice } from '@/lib/types'
import { PartyBadge } from './party-badge'
import { choiceLabel, choiceColor } from '@/lib/utils'

interface IndSenator {
  politician_id: string
  name: string
  first_name: string
  vote_choice: VoteChoice
}

interface PartyData {
  abbr: string
  color: string
  for: number
  against: number
  abstention: number
  total: number
}

interface Props {
  rows: PartyVoteBreakdown[]
  indSenators?: IndSenator[]
}

export function PartyBreakdown({ rows, indSenators }: Props) {
  const byParty = new Map<string, PartyData>()
  for (const r of rows) {
    if (r.party_abbr === 'IND') continue
    if (!byParty.has(r.party_abbr)) {
      byParty.set(r.party_abbr, {
        abbr: r.party_abbr,
        color: r.party_color,
        for: 0,
        against: 0,
        abstention: 0,
        total: 0,
      })
    }
    const p = byParty.get(r.party_abbr)!
    if (r.vote_choice === 'for')        p.for        += r.count
    if (r.vote_choice === 'against')    p.against    += r.count
    if (r.vote_choice === 'abstention') p.abstention += r.count
    p.total += r.count
  }

  const parties = [...byParty.values()].sort((a, b) => b.total - a.total)

  if (parties.length === 0 && !indSenators?.length) {
    return <p className="text-sm text-muted">Nu există date pe partide.</p>
  }

  return (
    <div className="space-y-2">
      {parties.map(p => {
        const stance: 'for' | 'against' | 'abstention' =
          p.for > p.against ? 'for' : p.against > p.for ? 'against' : 'abstention'
        const stanceLabel =
          stance === 'for' ? '▲ Pro' : stance === 'against' ? '▼ Contra' : '— Neutru'
        const stanceColor =
          stance === 'for' ? '#16a34a' : stance === 'against' ? '#dc2626' : '#6666aa'

        return (
          <div
            key={p.abbr}
            className="bg-surface border border-rim rounded-lg p-3"
            style={{ borderLeftWidth: 3, borderLeftColor: p.color }}
          >
            {/* Header row */}
            <div className="flex items-center justify-between mb-2">
              <PartyBadge abbreviation={p.abbr} color={p.color} />
              <span className="text-xs font-bold" style={{ color: stanceColor }}>
                {stanceLabel}
              </span>
            </div>

            {/* Stacked bar */}
            <div className="h-1.5 flex rounded overflow-hidden gap-px">
              {p.for > 0 && (
                <div className="bg-adoptat" style={{ flex: p.for }} title={`${p.for} pentru`} />
              )}
              {p.against > 0 && (
                <div className="bg-respins" style={{ flex: p.against }} title={`${p.against} împotrivă`} />
              )}
              {p.abstention > 0 && (
                <div className="bg-[#8888cc]" style={{ flex: p.abstention }} title={`${p.abstention} abțineri`} />
              )}
            </div>

            {/* Counts */}
            <div className="flex gap-3 mt-1.5 text-xs text-muted tabular-nums">
              {p.for > 0 && (
                <span><span className="text-adoptat font-semibold">{p.for}</span> pentru</span>
              )}
              {p.against > 0 && (
                <span><span className="text-respins font-semibold">{p.against}</span> împotrivă</span>
              )}
              {p.abstention > 0 && (
                <span><span className="text-[#8888cc] font-semibold">{p.abstention}</span> abțineri</span>
              )}
            </div>
          </div>
        )
      })}

      {/* Independents */}
      {indSenators && indSenators.length > 0 && (
        <div className="pt-1">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted mb-2">
            Independenți ({indSenators.length})
          </div>
          <div className="bg-surface border border-rim rounded-lg divide-y divide-rim">
            {indSenators.map(s => (
              <div key={s.politician_id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-foreground">{s.first_name} {s.name}</span>
                <span className="font-semibold tabular-nums" style={{ color: choiceColor(s.vote_choice) }}>
                  {choiceLabel(s.vote_choice)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
