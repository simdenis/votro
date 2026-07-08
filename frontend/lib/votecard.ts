import { hasPartyLine } from './utils'
import type { VoteCardData, PartyVote } from '@/components/cards/vote-card'
import type { SenatorCardData } from '@/components/cards/senator-card'
import type { LawCardData, JourneyStep } from '@/components/cards/law-card'
import type { PoliticianStats, LawStatus } from '@/lib/types'
import { formatDate, capFirst } from '@/lib/utils'

interface BreakdownRow { party_abbr: string; vote_choice: string; count: number }

/** Group party_vote_breakdown rows into PartyVote entries, largest group first.
 *  Returns every party — the cards size their rows to fit them all. */
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
}

/** Map a votes row (with joined laws) + breakdown rows to the VoteCard model.
 *  `seats` = current chamber size; enables true absentees (seats − participants)
 *  and the "X din Y prezenți" line. */
export function mapVoteToCard(vote: any, rows: BreakdownRow[], seats: number | null = null): VoteCardData {
  const isDep = vote.chamber === 'deputies'
  const forC = vote.for_count ?? 0
  const againstC = vote.against_count ?? 0
  const abstainC = vote.abstention_count ?? 0
  const notVoted = vote.not_voted_count ?? 0
  const participants = forC + againstC + abstainC + notVoted
  // Joint sessions (both chambers) have more voters than one chamber's seats —
  // the "X din Y mandate" / absentee framing is meaningless there, so drop seats.
  if (seats != null && participants > seats) seats = null
  return {
    lawCode: vote.laws?.code ?? 'VOT DE PLEN',
    lawTitle: capFirst(vote.laws?.title ?? vote.description ?? '') || 'Vot fără lege asociată',
    chamber: isDep ? 'CAMERĂ' : 'SENAT',
    result: vote.outcome === 'respins' ? 'RESPINS' : 'ADOPTAT',
    year: vote.vote_date ? new Date(vote.vote_date).getFullYear() : 2026,
    dateLabel: vote.vote_date ? formatDate(vote.vote_date) : null,
    votesFor: forC,
    votesAgainst: againstC,
    votesAbstain: abstainC,
    votesNotVoted: notVoted,
    votesAbsent: seats ? Math.max(0, seats - participants) : 0,
    seats,
    source: isDep ? 'cdep.ro' : 'senat.ro',
    parties: toParties(rows),
  }
}

// ── Senator/deputy ──────────────────────────────────────────────────────────
export function mapSenatorToCard(s: PoliticianStats, chamber: 'senate' | 'deputies'): SenatorCardData {
  const noLine = !hasPartyLine(s.party_abbr)
  return {
    fullName: `${s.first_name} ${s.name}`.trim(),
    partyAbbr: s.party_abbr,
    partyColor: s.party_color || '#9e9e9e',
    chamberLabel: chamber === 'deputies' ? 'DEPUTAT' : 'SENATOR',
    year: new Date().getFullYear(),
    totalVotes: s.total_votes ?? 0,
    votesFor: s.votes_for ?? 0,
    votesAgainst: s.votes_against ?? 0,
    votesAbstain: s.votes_abstention ?? 0,
    votesAbsent: s.votes_absent ?? 0,
    // floor: 0.4% deviation must not display as "100% loialitate"
    loyaltyPct: s.deviation_pct != null ? Math.floor(100 - s.deviation_pct) : null,
    deviations: s.deviations ?? 0,
    deviationPct: s.deviation_pct != null ? Math.round(s.deviation_pct) : null,
    noLine,
  }
}

// ── Law journey ──────────────────────────────────────────────────────────────
/** The vote whose party breakdown the law card shows: Camera when it voted, else Senat. */
export function lawDecisiveVoteId(law: LawStatus): { voteId: string; chamber: 'camera' | 'senate' } | null {
  if (law.camera_vote_id) return { voteId: law.camera_vote_id, chamber: 'camera' }
  if (law.senate_vote_id) return { voteId: law.senate_vote_id, chamber: 'senate' }
  return null
}

/** `forChamber` pins the party-vote section to one chamber (IG carousel slides);
 *  default keeps the decisive-vote behaviour. */
export function mapLawToCard(
  law: LawStatus,
  breakdownRows: BreakdownRow[] = [],
  forChamber: 'camera' | 'senate' | null = null,
): LawCardData {
  const promulgat = law.presidential_status === 'promulgat'
  const senateDone = law.senate_outcome === 'adoptat' || !!law.presidential_status
  const cameraDone = law.camera_outcome === 'adoptat' || !!law.presidential_status
  const rejected = law.senate_outcome === 'respins' || law.camera_outcome === 'respins'

  let finalStep: JourneyStep
  if (promulgat) finalStep = { label: 'Lege', done: true, final: true }
  else if (law.presidential_status === 'retrimis') finalStep = { label: 'Retrimisă', done: false, final: true }
  else if (law.presidential_status === 'sesizat_ccr') finalStep = { label: 'CCR', done: false, final: true }
  else finalStep = { label: 'Președinte', done: false, final: true }

  let statusLabel = 'ÎN DEZBATERE'
  let statusColor = '#0f2464'
  if (promulgat) { statusLabel = 'PROMULGATĂ'; statusColor = '#0f2464' }
  else if (rejected) { statusLabel = 'RESPINSĂ'; statusColor = '#c4362e' }
  else if (senateDone && cameraDone) { statusLabel = 'ADOPTATĂ'; statusColor = '#1a7a42' }

  const dateLine = promulgat && law.presidential_date
    ? `Promulgată · ${formatDate(law.presidential_date)}`
    : cameraDone && law.camera_vote_date
      ? `Adoptată · ${formatDate(law.camera_vote_date)}`
      : null

  const dateForYear = law.presidential_date || law.camera_vote_date || law.senate_vote_date
  const decisive = forChamber
    ? (forChamber === 'camera' && law.camera_vote_id ? { voteId: law.camera_vote_id, chamber: 'camera' as const }
      : forChamber === 'senate' && law.senate_vote_id ? { voteId: law.senate_vote_id, chamber: 'senate' as const }
      : null)
    : lawDecisiveVoteId(law)
  const isCam = decisive?.chamber === 'camera'
  return {
    lawCode: law.code,
    lawTitle: capFirst(law.title) || '—',
    category: law.law_category ?? null,
    year: dateForYear ? new Date(dateForYear).getFullYear() : new Date().getFullYear(),
    statusLabel,
    statusColor,
    dateLine,
    journey: [
      { label: 'Senat', done: senateDone },
      { label: 'Cameră', done: cameraDone },
      finalStep,
    ],
    voteChamber: decisive ? (isCam ? 'CAMERA DEPUTAȚILOR' : 'SENAT') : null,
    votesFor: decisive ? (isCam ? law.camera_for : law.senate_for) : null,
    votesAgainst: decisive ? (isCam ? law.camera_against : law.senate_against) : null,
    votesAbstain: decisive ? (isCam ? law.camera_abstentions : law.senate_abstentions) : null,
    parties: decisive ? toParties(breakdownRows) : [],
  }
}

export const SAMPLE_VOTE_CARD: VoteCardData = {
  lawCode: 'L 412/2026', lawTitle: 'Transparență parlamentară', chamber: 'SENAT', result: 'ADOPTAT', year: 2026,
  dateLabel: '12 iunie 2026',
  votesFor: 187, votesAgainst: 45, votesAbstain: 12, votesNotVoted: 0, votesAbsent: 23, seats: 267, source: 'senat.ro',
  parties: [
    { name: 'PSD', for: 60, against: 2, abstain: 1, absent: 5 },
    { name: 'PNL', for: 50, against: 1, abstain: 2, absent: 4 },
    { name: 'AUR', for: 5, against: 30, abstain: 3, absent: 6 },
    { name: 'USR', for: 40, against: 2, abstain: 1, absent: 3 },
    { name: 'UDMR', for: 18, against: 1, abstain: 1, absent: 2 },
  ],
}
