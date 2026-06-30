import type { VoteCardData, PartyVote } from '@/components/cards/vote-card'

interface BreakdownRow { party_abbr: string; vote_choice: string; count: number }

/** Group party_vote_breakdown rows into top-5 PartyVote entries. */
export function toParties(rows: BreakdownRow[]): PartyVote[] {
  const by: Record<string, PartyVote> = {}
  for (const row of rows) {
    const p = (by[row.party_abbr] ??= { name: row.party_abbr, for: 0, against: 0, abstain: 0, absent: 0 })
    const c = row.count ?? 0
    if (row.vote_choice === 'for') p.for += c
    else if (row.vote_choice === 'against') p.against += c
    else if (row.vote_choice === 'abstention') p.abstain += c
    else p.absent += c // not_voted / absent
  }
  return Object.values(by)
    .sort((a, b) => (b.for + b.against + b.abstain + b.absent) - (a.for + a.against + a.abstain + a.absent))
    .slice(0, 5)
}

/** Map a votes row (with joined laws) + breakdown rows to the VoteCard model. */
export function mapVoteToCard(vote: any, rows: BreakdownRow[]): VoteCardData {
  const isDep = vote.chamber === 'deputies'
  return {
    lawCode: vote.laws?.code ?? '—',
    lawTitle: vote.laws?.title ?? 'Transparență parlamentară',
    chamber: isDep ? 'CAMERĂ' : 'SENAT',
    result: vote.outcome === 'respins' ? 'RESPINS' : 'ADOPTAT',
    year: vote.vote_date ? new Date(vote.vote_date).getFullYear() : 2026,
    votesFor: vote.for_count ?? 0,
    votesAgainst: vote.against_count ?? 0,
    votesAbstain: vote.abstention_count ?? 0,
    votesAbsent: vote.not_voted_count ?? 0,
    source: isDep ? 'cdep.ro' : 'senat.ro',
    parties: toParties(rows),
  }
}

export const SAMPLE_VOTE_CARD: VoteCardData = {
  lawCode: 'L 412/2026', lawTitle: 'Transparență parlamentară', chamber: 'SENAT', result: 'ADOPTAT', year: 2026,
  votesFor: 187, votesAgainst: 45, votesAbstain: 12, votesAbsent: 23, source: 'senat.ro',
  parties: [
    { name: 'PSD', for: 60, against: 2, abstain: 1, absent: 5 },
    { name: 'PNL', for: 50, against: 1, abstain: 2, absent: 4 },
    { name: 'AUR', for: 5, against: 30, abstain: 3, absent: 6 },
    { name: 'USR', for: 40, against: 2, abstain: 1, absent: 3 },
    { name: 'UDMR', for: 18, against: 1, abstain: 1, absent: 2 },
  ],
}
