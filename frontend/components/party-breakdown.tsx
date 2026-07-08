import type { PartyVoteBreakdown } from '@/lib/types'
import { PartyBadge } from './party-badge'
import { HoverNames, type HoverPerson } from './hover-names'

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
  /** party -> vote_choice -> full names; enables hover lists on the counts */
  voters?: Record<string, Record<string, HoverPerson[]>>
}

// senat.ro labels unaffiliated senators "P" — the same as IND.
const foldAbbr = (a: string) => (a === 'P' ? 'IND' : a)
// Groups with no common party line — shown as a tally, not a collective stance.
const NO_STANCE = new Set(['IND', 'MIN'])

export function PartyBreakdown({ rows, voters }: Props) {
  const byParty = new Map<string, PartyData>()
  for (const r of rows) {
    const abbr = foldAbbr(r.party_abbr)
    if (!byParty.has(abbr)) {
      byParty.set(abbr, { abbr, color: r.party_color, for: 0, against: 0, abstention: 0, total: 0 })
    }
    const p = byParty.get(abbr)!
    if (r.vote_choice === 'for')        p.for        += r.count
    if (r.vote_choice === 'against')    p.against    += r.count
    if (r.vote_choice === 'abstention') p.abstention += r.count
    p.total += r.count
  }

  // Real parties first (by size), then the no-line groups (IND/MIN) last.
  const parties = [...byParty.values()].sort((a, b) => {
    const na = NO_STANCE.has(a.abbr) ? 1 : 0
    const nb = NO_STANCE.has(b.abbr) ? 1 : 0
    return na - nb || b.total - a.total
  })

  if (parties.length === 0) {
    return <p className="text-sm text-muted">Nu există date pe partide.</p>
  }

  return (
    <div className="space-y-2">
      {parties.map(p => {
        // IND (unaffiliated) and MIN (unrelated minority orgs) have no common
        // line — show a tally, not a collective "stance".
        const noStance = NO_STANCE.has(p.abbr)
        const stance: 'for' | 'against' | 'abstention' =
          p.for > p.against ? 'for' : p.against > p.for ? 'against' : 'abstention'
        const stanceLabel =
          stance === 'for' ? '▲ Pro' : stance === 'against' ? '▼ Contra' : '— Neutru'
        const stanceColor =
          stance === 'for' ? '#16a34a' : stance === 'against' ? '#dc2626' : '#6666aa'

        return (
          <div key={p.abbr} className="bg-surface border border-rim rounded-lg p-3">
            {/* Header row */}
            <div className="flex items-center justify-between mb-2">
              <PartyBadge abbreviation={p.abbr} color={p.color} />
              {noStance ? (
                <span className="text-[10px] text-faint" title="Grup fără linie comună — voturi individuale">vot individual</span>
              ) : (
                <span className="text-xs font-bold" style={{ color: stanceColor }}>
                  {stanceLabel}
                </span>
              )}
            </div>

            {/* Counts — hover a number to see who */}
            <div className="flex gap-3 text-xs text-muted tabular-nums">
              {p.for > 0 && (
                <HoverNames people={voters?.[p.abbr]?.for ?? []} title={`${p.abbr} — pentru`}>
                  <span><span className="text-adoptat font-semibold">{p.for}</span> pentru</span>
                </HoverNames>
              )}
              {p.against > 0 && (
                <HoverNames people={voters?.[p.abbr]?.against ?? []} title={`${p.abbr} — împotrivă`}>
                  <span><span className="text-respins font-semibold">{p.against}</span> împotrivă</span>
                </HoverNames>
              )}
              {p.abstention > 0 && (
                <HoverNames people={voters?.[p.abbr]?.abstention ?? []} title={`${p.abbr} — abțineri`}>
                  <span><span className="text-[#8888cc] font-semibold">{p.abstention}</span> abțineri</span>
                </HoverNames>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
